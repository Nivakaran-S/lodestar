# =============================================================================
# Naming convention
#   <abbr>-<project>-<env>-<region>        e.g. aks-lodestar-dev-sea
#   <abbr><project><env><suffix>           globally unique, no dashes (ACR, KV)
# =============================================================================
locals {
  region_short = lookup({
    southeastasia = "sea"
    centralindia  = "inc"
    southindia    = "ins"
    eastus2       = "eus2"
    westeurope    = "weu"
    uksouth       = "uks"
  }, var.location, substr(var.location, 0, 4))

  name       = "${var.project}-${var.environment}-${local.region_short}"
  compact    = "${var.project}${var.environment}${var.unique_suffix}"
  acr_name   = "cr${local.compact}"
  kv_name    = substr("kv-${var.project}-${var.environment}-${var.unique_suffix}", 0, 24)
  k8s_ns     = "lodestar"
  ingress_ns = "aks-istio-ingress"

  tags = merge({
    project     = var.project
    environment = var.environment
    managed-by  = "terraform"
    repo        = "Nivakaran-S/lodestar"
    owner       = var.owner
    cost-center = var.cost_center
  }, var.extra_tags)

  # ---------------------------------------------------------------------------
  # Services (PLATFORM.md section 1). schema = Postgres schema / login role.
  # api_roles = least-privilege app roles on lodestar-api for S2S calls; they
  # mirror the Istio AuthorizationPolicy edges in deploy/k8s/base/istio.
  # ---------------------------------------------------------------------------
  services = {
    auth          = { api_roles = ["svc", "audit.write", "notifications.send"] }
    orders        = { api_roles = ["svc", "audit.write", "notifications.send", "outlets.read"] }
    planning      = { api_roles = ["svc", "audit.write", "notifications.send", "orders.read", "fleet.read", "outlets.read", "trips.write", "auth.read", "agent.invoke"] }
    fleet         = { api_roles = ["svc", "audit.write", "notifications.send"] }
    outlets       = { api_roles = ["svc", "audit.write"] }
    trips         = { api_roles = ["svc", "audit.write", "notifications.send", "auth.read", "orders.read", "orders.write", "fleet.read", "outlets.read"] }
    sync          = { api_roles = ["svc", "audit.write", "notifications.send", "auth.read", "orders.write", "trips.write"] }
    notifications = { api_roles = ["svc", "audit.write", "auth.read"] }
    audit         = { api_roles = ["svc"] }
    agent         = { api_roles = ["svc", "audit.write", "orders.read", "fleet.read", "outlets.read"] }
  }
  schemas = keys(local.services)

  web_hostname   = var.web_hostname
  field_hostname = var.field_hostname
}

resource "azurerm_resource_group" "this" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

# ----------------------------------------------------------------- monitoring
module "monitoring" {
  source              = "../monitoring"
  name                = local.name
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  retention_in_days   = var.log_retention_days
  tags                = local.tags

  diagnostic_targets = {
    aks = {
      resource_id = module.aks.id
      log_groups  = []
      logs        = ["kube-apiserver", "kube-audit-admin", "kube-controller-manager", "guard", "cluster-autoscaler"]
    }
    keyvault = {
      resource_id = module.keyvault.raw_id
      log_groups  = ["audit"]
    }
    acr = {
      resource_id = module.acr.id
    }
    postgres = {
      resource_id = module.postgres.id
    }
    redis = {
      resource_id = module.redis.id
    }
    frontdoor = {
      resource_id = module.frontdoor.profile_id
    }
  }
}

# ----------------------------------------------------------------- network
module "network" {
  source                  = "../network"
  name                    = local.name
  resource_group_name     = azurerm_resource_group.this.name
  location                = var.location
  address_space           = var.vnet_address_space
  subnets                 = var.subnets
  zones                   = var.zones
  extra_private_dns_zones = concat(["privatelink.redis.cache.windows.net"], var.enable_openai ? ["privatelink.openai.azure.com"] : [])
  tags                    = local.tags
}

# ----------------------------------------------------------------- AKS
module "aks" {
  source                          = "../aks"
  name                            = local.name
  resource_group_name             = azurerm_resource_group.this.name
  location                        = var.location
  kubernetes_version              = var.kubernetes_version
  sku_tier                        = var.aks_sku_tier
  private_cluster_enabled         = var.aks_private_cluster
  api_server_authorized_ip_ranges = var.deployer_ip_ranges
  admin_group_object_ids          = var.platform_admin_group_object_ids
  system_subnet_id                = module.network.subnet_ids.aks_system
  user_subnet_id                  = module.network.subnet_ids.aks_user
  private_link_subnet_id          = module.network.subnet_ids.private_link
  istio_revision                  = var.istio_revision
  log_analytics_workspace_id      = module.monitoring.workspace_id
  zones                           = var.zones
  system_node_vm_size             = var.system_node_vm_size
  system_node_min                 = var.system_node_min
  system_node_max                 = var.system_node_max
  user_node_vm_size               = var.user_node_vm_size
  user_node_min                   = var.user_node_min
  user_node_max                   = var.user_node_max
  user_pool_per_zone              = var.user_pool_per_zone
  keda_enabled                    = true # KEDA ScaledObjects in deploy/k8s depend on it
  autoscaler_profile              = var.aks_autoscaler_profile
  agent_spot_pool                 = var.agent_spot_pool
  tags                            = local.tags

  # NAT gateway must be attached to the node subnets before cluster creation.
  depends_on = [module.network]
}

# ----------------------------------------------------------------- ACR
module "acr" {
  source                     = "../acr"
  name                       = local.acr_name
  resource_group_name        = azurerm_resource_group.this.name
  location                   = var.location
  private_endpoint_subnet_id = module.network.subnet_ids.private_endpoints
  private_dns_zone_id        = module.network.private_dns_zone_ids["privatelink.azurecr.io"]
  kubelet_object_id          = module.aks.kubelet_object_id
  allowed_ip_ranges          = var.deployer_ip_ranges
  zone_redundancy_enabled    = var.acr_zone_redundancy
  tags                       = local.tags
}

# ----------------------------------------------------------------- Key Vault
module "keyvault" {
  source                     = "../keyvault"
  name                       = local.kv_name
  resource_group_name        = azurerm_resource_group.this.name
  location                   = var.location
  private_endpoint_subnet_id = module.network.subnet_ids.private_endpoints
  private_dns_zone_id        = module.network.private_dns_zone_ids["privatelink.vaultcore.azure.net"]
  allowed_ip_ranges          = var.deployer_ip_ranges
  admin_group_object_ids     = var.platform_admin_group_object_ids
  ingress_hostnames          = [local.web_hostname, local.field_hostname]
  tags                       = local.tags
}

# ----------------------------------------------------------------- Postgres
module "postgres" {
  source                       = "../postgres"
  name                         = local.name
  resource_group_name          = azurerm_resource_group.this.name
  location                     = var.location
  delegated_subnet_id          = module.network.subnet_ids.postgres
  private_dns_zone_id          = module.network.postgres_private_dns_zone_id
  key_vault_id                 = module.keyvault.id
  service_schemas              = local.schemas
  sku_name                     = var.postgres_sku
  storage_mb                   = var.postgres_storage_mb
  high_availability            = var.postgres_high_availability
  backup_retention_days        = var.postgres_backup_retention_days
  geo_redundant_backup_enabled = var.postgres_geo_redundant_backup
  entra_admin_group_object_id  = var.db_admin_group_object_id
  tags                         = local.tags
}

# ----------------------------------------------------------------- Redis
# Socket.IO adapter for notifications (horizontal scaling, PLATFORM.md section 9).
module "redis" {
  source                     = "../redis"
  name                       = "redis-${var.project}-${var.environment}-${var.unique_suffix}"
  resource_group_name        = azurerm_resource_group.this.name
  location                   = var.location
  sku_name                   = var.redis_sku_name
  capacity                   = var.redis_capacity
  zones                      = var.zones
  private_endpoint_subnet_id = module.network.subnet_ids.private_endpoints
  private_dns_zone_id        = module.network.private_dns_zone_ids["privatelink.redis.cache.windows.net"]
  key_vault_id               = module.keyvault.id
  tags                       = local.tags
}

# ----------------------------------------------------------------- identity
module "identity" {
  source                 = "../identity"
  name                   = local.name
  environment            = var.environment
  resource_group_name    = azurerm_resource_group.this.name
  location               = var.location
  oidc_issuer_url        = module.aks.oidc_issuer_url
  acr_id                 = module.acr.id
  role_group_object_ids  = var.role_group_object_ids
  app_owner_object_ids   = var.app_owner_object_ids
  ci_principal_object_id = var.ci_principal_object_id
  tags                   = local.tags

  web_redirect_uris = [
    "https://${local.web_hostname}/",
    "https://${local.web_hostname}/auth/callback",
  ]
  field_spa_redirect_uris = [
    "https://${local.field_hostname}/",
    "https://${local.field_hostname}/auth/callback",
  ]

  workloads = merge(
    { for s, cfg in local.services : s => {
      namespace            = local.k8s_ns
      service_account      = s
      api_roles            = cfg.api_roles
      key_vault_secret_ids = concat([module.postgres.service_url_secret_ids[s]], lookup(local.extra_workload_secret_ids, s, []))
    } },
    {
      # PreSync migrate/seed job: admin URL + every service password (creates roles).
      migrate = {
        namespace            = local.k8s_ns
        service_account      = "migrate"
        key_vault_secret_ids = concat([module.postgres.admin_url_secret_id], [for s in local.schemas : module.postgres.service_password_secret_ids[s]])
      }
      # Syncs the origin TLS certificate into the Istio ingress namespace.
      ingress-tls = {
        namespace            = local.ingress_ns
        service_account      = "lodestar-ingress-tls"
        key_vault_secret_ids = [module.keyvault.ingress_certificate_secret_id]
      }
    }
  )
}

# Secrets a workload reads besides its own database URL:
#   agent, sync    their role's password, for the KEDA postgresql scaler
#                  (TriggerAuthentication in deploy/k8s/base/services/<svc>)
#   notifications  the Redis URL for the Socket.IO adapter
locals {
  extra_workload_secret_ids = {
    agent         = [module.postgres.service_password_secret_ids["agent"]]
    sync          = [module.postgres.service_password_secret_ids["sync"]]
    notifications = [module.redis.url_secret_id]
  }
}

# ----------------------------------------------------------------- Front Door
module "frontdoor" {
  source                      = "../frontdoor"
  name                        = local.name
  resource_group_name         = azurerm_resource_group.this.name
  location                    = var.location
  web_hostname                = local.web_hostname
  field_hostname              = local.field_hostname
  custom_domains_enabled      = var.frontdoor_custom_domains_enabled
  dns_zone_id                 = var.dns_zone_id
  origin_enabled              = var.frontdoor_origin_enabled
  private_link_service_id     = var.frontdoor_origin_enabled ? "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${module.aks.node_resource_group}/providers/Microsoft.Network/privateLinkServices/${var.ingress_pls_name}" : null
  origin_private_ip           = var.ingress_internal_ip
  waf_mode                    = var.waf_mode
  rate_limit_per_minute       = var.waf_rate_limit_per_minute
  write_rate_limit_per_minute = var.waf_write_rate_limit_per_minute
  geo_allow_countries         = var.waf_geo_allow_countries
  tags                        = local.tags
}

data "azurerm_client_config" "current" {}

# ----------------------------------------------------------------- Azure OpenAI (off)
module "openai" {
  count                      = var.enable_openai ? 1 : 0
  source                     = "../openai"
  name                       = local.name
  resource_group_name        = azurerm_resource_group.this.name
  location                   = var.openai_location == null ? var.location : var.openai_location
  private_endpoint_subnet_id = module.network.subnet_ids.private_endpoints
  private_dns_zone_id        = module.network.private_dns_zone_ids["privatelink.openai.azure.com"]
  agent_principal_id         = module.identity.workload_principal_ids["agent"]
  tags                       = local.tags
}

# ----------------------------------------------------------------- Argo CD
module "argocd" {
  count                  = var.install_argocd ? 1 : 0
  source                 = "../argocd"
  environment            = var.environment
  git_repo_url           = var.git_repo_url
  git_target_revision    = var.git_target_revision
  git_repo_password      = var.git_repo_password
  argocd_chart_version   = var.argocd_chart_version
  admin_group_object_ids = var.platform_admin_group_object_ids

  depends_on = [module.aks]
}
