# ------------------------------------------------------------------ identity of the stack
variable "project" {
  type    = string
  default = "lodestar"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "location" {
  type    = string
  default = "southeastasia"
}

variable "unique_suffix" {
  description = "3-6 lowercase alphanumerics for globally unique names."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,6}$", var.unique_suffix))
    error_message = "unique_suffix must be 3-6 lowercase letters or digits."
  }
}

variable "owner" {
  type    = string
  default = "team-adagard"
}

variable "cost_center" {
  type    = string
  default = "tech-triathlon"
}

variable "extra_tags" {
  type    = map(string)
  default = {}
}

variable "zones" {
  type    = list(string)
  default = ["1", "2", "3"]
}

# ------------------------------------------------------------------ access
variable "deployer_ip_ranges" {
  description = "Public CIDRs of Jenkins/admins allowed to reach the AKS API, ACR and Key Vault data planes. Empty = private only (run from inside the VNet)."
  type        = list(string)
  default     = []
}

variable "platform_admin_group_object_ids" {
  description = "Entra groups with cluster admin, Key Vault admin and Argo CD admin."
  type        = list(string)
  default     = []
}

variable "db_admin_group_object_id" {
  description = "Entra group set as Postgres Entra administrator."
  type        = string
  default     = null
}

variable "role_group_object_ids" {
  description = "App role => Entra group object ID (store_manager, dispatcher, loader, driver, admin)."
  type        = map(string)
  default     = {}
}

variable "app_owner_object_ids" {
  type    = list(string)
  default = []
}

variable "ci_principal_object_id" {
  description = "Jenkins service principal object ID (gets AcrPush)."
  type        = string
  default     = null
}

# ------------------------------------------------------------------ network
variable "vnet_address_space" {
  type    = string
  default = "10.40.0.0/16"
}

variable "subnets" {
  type = object({
    aks_system        = string
    aks_user          = string
    postgres          = string
    private_endpoints = string
    private_link      = string
    appgw             = string
  })
  default = {
    aks_system        = "10.40.0.0/22"
    aks_user          = "10.40.4.0/22"
    postgres          = "10.40.8.0/24"
    private_endpoints = "10.40.9.0/24"
    private_link      = "10.40.10.0/24"
    appgw             = "10.40.11.0/24"
  }
}

# ------------------------------------------------------------------ AKS
variable "kubernetes_version" {
  type    = string
  default = null
}

variable "aks_sku_tier" {
  type    = string
  default = "Free"
}

variable "aks_private_cluster" {
  type    = bool
  default = false
}

variable "istio_revision" {
  description = "AKS Istio add-on revision (az aks mesh get-revisions)."
  type        = string
  default     = "asm-1-26"
}

variable "system_node_vm_size" {
  type    = string
  default = "Standard_D4ds_v5"
}

variable "system_node_min" {
  type    = number
  default = 1
}

variable "system_node_max" {
  type    = number
  default = 3
}

variable "user_node_vm_size" {
  type    = string
  default = "Standard_D4ds_v5"
}

variable "user_node_min" {
  type    = number
  default = 1
}

variable "user_node_max" {
  type    = number
  default = 5
}

variable "user_pool_per_zone" {
  description = "One autoscaled user pool per zone (true) or one across all zones (false). user_node_min/max apply per pool."
  type        = bool
  default     = true
}

variable "aks_autoscaler_profile" {
  description = "Cluster autoscaler tuning (see modules/aks var.autoscaler_profile)."
  type = object({
    expander                         = optional(string, "least-waste")
    scan_interval                    = optional(string, "10s")
    scale_down_delay_after_add       = optional(string, "10m")
    scale_down_unneeded              = optional(string, "10m")
    scale_down_utilization_threshold = optional(string, "0.5")
  })
  default = {}
}

variable "agent_spot_pool" {
  description = "Optional spot pool for the planning agent (see modules/aks var.agent_spot_pool)."
  type = object({
    enabled   = optional(bool, false)
    vm_size   = optional(string, "Standard_D4ds_v5")
    max_count = optional(number, 3)
    max_price = optional(number, -1)
  })
  default = {}
}

# ------------------------------------------------------------------ Redis
variable "redis_sku_name" {
  description = "Azure Cache for Redis tier for the Socket.IO adapter."
  type        = string
  default     = "Standard"
}

variable "redis_capacity" {
  type    = number
  default = 1
}

# ------------------------------------------------------------------ data
variable "acr_zone_redundancy" {
  type    = bool
  default = false
}

variable "postgres_sku" {
  type    = string
  default = "B_Standard_B2s"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_high_availability" {
  type    = bool
  default = false
}

variable "postgres_backup_retention_days" {
  type    = number
  default = 7
}

variable "postgres_geo_redundant_backup" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type    = number
  default = 30
}

# ------------------------------------------------------------------ edge
variable "web_hostname" {
  description = "Desk UI + API host, e.g. app.dev.lodestar.example.com."
  type        = string
}

variable "field_hostname" {
  description = "Field app (mobile-web) host, e.g. field.dev.lodestar.example.com."
  type        = string
}

variable "dns_zone_id" {
  type    = string
  default = null
}

variable "frontdoor_custom_domains_enabled" {
  type    = bool
  default = false
}

variable "frontdoor_origin_enabled" {
  description = "Second apply: wire Front Door to the ingress Private Link Service once Argo CD has created it."
  type        = bool
  default     = false
}

variable "ingress_pls_name" {
  description = "Must match azure-pls-name in deploy/k8s/base/istio/ingress-pls-service.yaml."
  type        = string
  default     = "pls-lodestar-ingress"
}

variable "ingress_internal_ip" {
  description = "Static internal IP of the ingress LB (inside snet-aks-user)."
  type        = string
  default     = null
}

variable "waf_mode" {
  type    = string
  default = "Prevention"
}

variable "waf_rate_limit_per_minute" {
  type    = number
  default = 1000
}

variable "waf_write_rate_limit_per_minute" {
  type    = number
  default = 200
}

variable "waf_geo_allow_countries" {
  type    = list(string)
  default = []
}

# ------------------------------------------------------------------ AI
variable "enable_openai" {
  type    = bool
  default = false
}

variable "openai_location" {
  type    = string
  default = null
}

# ------------------------------------------------------------------ GitOps
variable "install_argocd" {
  type    = bool
  default = true
}

variable "argocd_chart_version" {
  type    = string
  default = "7.8.13"
}

variable "git_repo_url" {
  type    = string
  default = "https://github.com/Nivakaran-S/lodestar.git"
}

variable "git_target_revision" {
  type    = string
  default = "main"
}

variable "git_repo_password" {
  type      = string
  default   = null
  sensitive = true
}
