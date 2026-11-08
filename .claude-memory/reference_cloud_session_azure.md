---
name: cloud-session-azure
description: "How a Claude Code cloud session reaches Azure for Bonsai Greenhouse: the 'Bonsai Greenhouse (Azure ops)' claude.ai environment, a pip-installed az in a venv, device-code login as the operator account, az logout at the end."
metadata:
  node_type: memory
  type: reference
  originSessionId: 013Biacmq4QrTqsQTVsKuSWu
  modified: 2026-11-08T10:05:00.000Z
---

A claude.ai cloud session has no Azure CLI and, on the Default environment, no route to `management.azure.com` (the proxy answers 403 to the CONNECT). Set up on 2026-11-08:

- **Environment:** start operator sessions on the personal claude.ai environment **"Bonsai Greenhouse (Azure ops)"** (both repos attached). Allowed hosts: `login.microsoftonline.com`, `management.azure.com`, `graph.microsoft.com`, `api.loganalytics.io`, `australiaeast.azurecontainerapps.dev` (live log tail), `aka.ms`, `azcliextensionsync.blob.core.windows.net`, `azcliprod.blob.core.windows.net`. Key Vault and ACR data planes are deliberately not allowed.
- **CLI:** `python3 -m venv ~/azcli && ~/azcli/bin/pip install --quiet azure-cli` (about 5 minutes), then `az extension add -n containerapp --allow-preview true` and `-n log-analytics --allow-preview true`. The `monitor log-analytics query` command does not exist without the extension.
- **Login:** `az login --use-device-code`, give Drew the code for his phone, `az account set --subscription 'Sponge Box Consulting - Business Sub'`, confirm with `az account show`. Log out with `az logout` at the end; never store a credential.
- **Account:** use the dedicated operator user (Reader on `rg-agentic-gaming` + custom role "Bonsai Greenhouse Operator"), once Drew has created it with `scripts/new-operator-account.sh` in Azure Cloud Shell. Until then the guest N3rdage@outlook.com.au works but holds Contributor on the whole subscription. Guest UPNs are the mangled `#EXT#` form, so address them by object id, never by email.
- **Run logs:** `az containerapp job execution list -n caj-agenticgaming-orchestrator -g rg-agentic-gaming` for status and image; Log Analytics `ContainerAppConsoleLogs_CL` filtered on `ContainerGroupName_s startswith '<execution>'` for finished runs; `az containerapp job logs show --execution <name> --container orchestrator` for a live tail. Only the entrypoint's own lines reach the console; Claude's output appears as a summary at the end.

**Why:** Drew operates from his phone and wants Azure checks possible without his laptop and without a broad account in the session.

**How to apply:** follow the "Operating from a Claude Code cloud session" section of `docs/runbook.md` in agentic-gaming; it is the authoritative copy. See [[agentic-gaming-infra]], [[azure-subscription-check]], [[git-bash-pathconv]].
