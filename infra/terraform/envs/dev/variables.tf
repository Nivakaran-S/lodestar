# Only tenant-specific inputs live in tfvars; sizing for this environment is
# in main.tf so it is reviewed in pull requests.

variable "subscription_id" {
  description = "Target subscription. null = use ARM_SUBSCRIPTION_ID."
  type        = string
  default     = null
}

variable "unique_suffix" {
  type = string
}

variable "location" {
  type    = string
  default = "southeastasia"
}

variable "kubelogin_mode" {
  description = "azurecli (humans), workloadidentity or spn (Jenkins)."
  type        = string
  default     = "azurecli"
}

variable "web_hostname" {
  type = string
}

variable "field_hostname" {
  type = string
}

variable "deployer_ip_ranges" {
  type    = list(string)
  default = []
}

variable "platform_admin_group_object_ids" {
  type    = list(string)
  default = []
}

variable "db_admin_group_object_id" {
  type    = string
  default = null
}

variable "role_group_object_ids" {
  type    = map(string)
  default = {}
}

variable "app_owner_object_ids" {
  type    = list(string)
  default = []
}

variable "ci_principal_object_id" {
  type    = string
  default = null
}

variable "frontdoor_origin_enabled" {
  type    = bool
  default = false
}

variable "ingress_internal_ip" {
  type    = string
  default = null
}

variable "enable_openai" {
  type    = bool
  default = false
}

variable "git_repo_url" {
  type    = string
  default = "https://github.com/Nivakaran-S/lodestar.git"
}

variable "git_repo_password" {
  description = "Set via TF_VAR_git_repo_password for a private repo."
  type        = string
  default     = null
  sensitive   = true
}
