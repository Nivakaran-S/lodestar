# Waypoint Lodestar: the public demo. One VM runs the same docker compose stack as a laptop, behind Caddy
# with a Let's Encrypt certificate for the Azure DNS name. Deliberately small: no managed database, no Front
# Door, no registry, no Log Analytics, no spot VM, no auto-shutdown (the demo must stay up for the judges).

resource "azurerm_resource_group" "demo" {
  name     = "${var.name}-rg"
  location = var.location
  tags     = var.tags
}

resource "azurerm_virtual_network" "demo" {
  name                = "${var.name}-vnet"
  location            = azurerm_resource_group.demo.location
  resource_group_name = azurerm_resource_group.demo.name
  address_space       = ["10.40.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "vm" {
  name                 = "vm"
  resource_group_name  = azurerm_resource_group.demo.name
  virtual_network_name = azurerm_virtual_network.demo.name
  address_prefixes     = ["10.40.1.0/24"]
}

resource "azurerm_network_security_group" "vm" {
  name                = "${var.name}-nsg"
  location            = azurerm_resource_group.demo.location
  resource_group_name = azurerm_resource_group.demo.name
  tags                = var.tags

  security_rule {
    name                       = "http"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "https"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "ssh-admin-only"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.ssh_source_cidr
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "vm" {
  subnet_id                 = azurerm_subnet.vm.id
  network_security_group_id = azurerm_network_security_group.vm.id
}

resource "azurerm_public_ip" "vm" {
  name                = "${var.name}-ip"
  location            = azurerm_resource_group.demo.location
  resource_group_name = azurerm_resource_group.demo.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = var.dns_label
  tags                = var.tags
}

resource "azurerm_network_interface" "vm" {
  name                = "${var.name}-nic"
  location            = azurerm_resource_group.demo.location
  resource_group_name = azurerm_resource_group.demo.name
  tags                = var.tags

  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.vm.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.vm.id
  }
}

resource "azurerm_linux_virtual_machine" "vm" {
  name                  = "${var.name}-vm"
  location              = azurerm_resource_group.demo.location
  resource_group_name   = azurerm_resource_group.demo.name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.vm.id]
  custom_data           = base64encode(templatefile("${path.module}/cloud-init.yaml", { install_k3s = var.install_k3s, admin_username = var.admin_username }))
  tags                  = var.tags

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(pathexpand(var.ssh_public_key_path))
  }

  os_disk {
    name                 = "${var.name}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  # Azure never returns custom_data, so after a `terraform import` (moving the VM between subscriptions)
  # Terraform would replace the VM to "restore" it. cloud-init only runs on first boot anyway; a new VM
  # with different cloud-init (e.g. install_k3s) needs `terraform apply -replace=azurerm_linux_virtual_machine.vm`.
  lifecycle {
    ignore_changes = [custom_data]
  }
}

# Two budgets, because the student credit is one $100 pot while Azure budgets reset on their time grain:
#  - "credit": the whole credit, one year from budget_start_date; alerts as it is used up (actual and forecast)
#  - "monthly": the expected run rate (~$45/month for this VM); alerts early if a month costs more than planned
resource "azurerm_consumption_budget_resource_group" "credit" {
  name              = "${var.name}-credit"
  resource_group_id = azurerm_resource_group.demo.id
  amount            = var.credit_amount
  time_grain        = "Annually"

  time_period {
    start_date = "${var.budget_start_date}T00:00:00Z"
  }

  dynamic "notification" {
    for_each = [25, 50, 75, 90]
    content {
      enabled        = true
      operator       = "GreaterThanOrEqualTo"
      threshold      = notification.value
      threshold_type = "Actual"
      contact_emails = var.budget_alert_emails
    }
  }

  notification {
    enabled        = true
    operator       = "GreaterThanOrEqualTo"
    threshold      = 100 # forecast: the credit will run out within the year at the current rate
    threshold_type = "Forecasted"
    contact_emails = var.budget_alert_emails
  }
}

resource "azurerm_consumption_budget_resource_group" "monthly" {
  name              = "${var.name}-monthly"
  resource_group_id = azurerm_resource_group.demo.id
  amount            = var.monthly_budget
  time_grain        = "Monthly"

  time_period {
    start_date = "${var.budget_start_date}T00:00:00Z"
  }

  notification {
    enabled        = true
    operator       = "GreaterThanOrEqualTo"
    threshold      = 50
    threshold_type = "Actual"
    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    operator       = "GreaterThanOrEqualTo"
    threshold      = 100
    threshold_type = "Actual"
    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    operator       = "GreaterThanOrEqualTo"
    threshold      = 110 # forecast: this month will cost more than planned
    threshold_type = "Forecasted"
    contact_emails = var.budget_alert_emails
  }
}
