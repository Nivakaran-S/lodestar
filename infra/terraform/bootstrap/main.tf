locals {
  tags = merge({
    project    = var.project
    component  = "tfstate"
    managed-by = "terraform"
    repo       = "Nivakaran-S/lodestar"
  }, var.tags)
}

resource "azurerm_resource_group" "state" {
  name     = "rg-${var.project}-tfstate"
  location = var.location
  tags     = local.tags
}

resource "azurerm_storage_account" "state" {
  name                              = "st${var.project}tf${var.unique_suffix}"
  resource_group_name               = azurerm_resource_group.state.name
  location                          = azurerm_resource_group.state.location
  account_tier                      = "Standard"
  account_replication_type          = "GRS"
  account_kind                      = "StorageV2"
  min_tls_version                   = "TLS1_2"
  https_traffic_only_enabled        = true
  allow_nested_items_to_be_public   = false
  shared_access_key_enabled         = false # Entra ID auth only (use_azuread_auth = true in backends)
  default_to_oauth_authentication   = true
  infrastructure_encryption_enabled = true

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  network_rules {
    default_action = length(var.allowed_ip_ranges) > 0 ? "Deny" : "Allow"
    bypass         = ["AzureServices"]
    ip_rules       = var.allowed_ip_ranges
  }

  tags = local.tags
}

resource "azurerm_storage_container" "state" {
  for_each              = toset(var.environments)
  name                  = "tfstate-${each.key}"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

resource "azurerm_management_lock" "state" {
  name       = "do-not-delete-tfstate"
  scope      = azurerm_storage_account.state.id
  lock_level = "CanNotDelete"
  notes      = "Holds Terraform remote state for ${var.project}."
}

resource "azurerm_role_assignment" "state_contributor" {
  for_each             = toset(var.state_contributor_object_ids)
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}
