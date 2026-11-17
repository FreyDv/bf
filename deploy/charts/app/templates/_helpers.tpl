{{- define "app.fullname" -}}
{{- .Release.Name | trunc 40 | trimSuffix "-" -}}
{{- end -}}

{{- define "app.secretName" -}}
{{- printf "%s-secrets" (include "app.fullname" .) -}}
{{- end -}}

{{- define "app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "app.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "app.labels" -}}
{{ include "app.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "app.image" -}}
{{- $repository := required "image.repository is required" .Values.image.repository -}}
{{- $tag := required "image.tag is required (the commit SHA, deploy/apps/<app>/image.yaml)" .Values.image.tag -}}
{{- if eq $tag "latest" -}}
{{- fail "image.tag must be a commit SHA, not latest (ADR-026)" -}}
{{- end -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}

{{- define "app.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: {{ .Values.securityContext.runAsUser }}
runAsGroup: {{ .Values.securityContext.runAsGroup }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "app.containerSecurityContext" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: {{ .Values.securityContext.readOnlyRootFilesystem }}
capabilities:
  drop: [ALL]
{{- end -}}

{{- define "app.extraSecretName" -}}
{{- printf "%s-%s-secrets" (include "app.fullname" .root) .name -}}
{{- end -}}

{{- define "app.dbCaName" -}}
{{- printf "%s-db-ca" (include "app.fullname" .) -}}
{{- end -}}

{{- define "app.dbCaDir" -}}/etc/bf/db-ca{{- end -}}

{{/* The names every role secret of a database carries (ADR-061). DATABASE_URL is not one of them: it is never used. */}}
{{- define "app.dbKeys" -}}
DB_HOST DB_PORT DB_NAME DB_SCHEMA DB_SSL_MODE DB_USER DB_PASSWORD
{{- end -}}

{{/* Plain environment, the same for the Deployment, the CronJobs and the migration Job. */}}
{{- define "app.env" -}}
{{- range $name, $value := .Values.env }}
- name: {{ $name }}
  value: {{ $value | quote }}
{{- end }}
{{- if .Values.dbCa.pem }}
- name: DB_SSL_CA_FILE
  value: {{ printf "%s/ca.crt" (include "app.dbCaDir" .) | quote }}
{{- end }}
{{- end -}}

{{/* Deployment and CronJob: the secret of role `app`, then the named Secrets. Never the migrator secret. */}}
{{- define "app.envFrom" -}}
{{- if .Values.secret.encryptedData }}
- secretRef:
    name: {{ include "app.secretName" . }}
{{- end }}
{{- range .Values.envFromSecrets }}
- secretRef:
    name: {{ . }}
{{- end }}
{{- end -}}

{{/* Migration Job: only the secret of role `migrator`, nothing of the Deployment (ADR-053 item 4, ADR-061). */}}
{{- define "app.migrationEnvFrom" -}}
{{- if (.Values.extraSecrets.migrator).encryptedData }}
- secretRef:
    name: {{ include "app.extraSecretName" (dict "root" . "name" "migrator") }}
{{- end }}
{{- end -}}

{{- define "app.tmpVolumeMount" -}}
- name: tmp
  mountPath: /tmp
{{- end -}}

{{- define "app.tmpVolume" -}}
- name: tmp
  emptyDir: {}
{{- end -}}

{{- define "app.volumeMounts" -}}
{{ include "app.tmpVolumeMount" . }}
{{- if .Values.dbCa.pem }}
- name: db-ca
  mountPath: {{ include "app.dbCaDir" . }}
  readOnly: true
{{- end }}
{{- end -}}

{{- define "app.volumes" -}}
{{ include "app.tmpVolume" . }}
{{- if .Values.dbCa.pem }}
- name: db-ca
  configMap:
    name: {{ include "app.dbCaName" . }}
    items:
      - key: ca.crt
        path: ca.crt
{{- end }}
{{- end -}}

{{/*
Refuses what cannot work, by key names only (never values). A secret that holds any DB_* key must hold all seven of
"app.dbKeys"; with the migration on, the `app` secret and extraSecrets.migrator are database secrets by definition.
A database secret and the migration both need the CA (ADR-053 item 5, ADR-061).
*/}}
{{- define "app.validate" -}}
{{- $migration := .Values.migration.enabled -}}
{{- if $migration -}}
{{- if not .Values.secret.encryptedData -}}
{{- fail "migration.enabled requires secret.encryptedData: the secret of role app for the Deployment (ADR-061)" -}}
{{- end -}}
{{- if not (.Values.extraSecrets.migrator).encryptedData -}}
{{- fail "migration.enabled requires extraSecrets.migrator.encryptedData: the secret of role migrator for the migration Job (ADR-061)" -}}
{{- end -}}
{{- end -}}
{{- $entries := list (dict "label" "secret.encryptedData" "data" (.Values.secret.encryptedData | default dict) "forced" $migration) -}}
{{- range $name, $extra := .Values.extraSecrets -}}
{{- $data := dict -}}
{{- if kindIs "map" $extra -}}
{{- $data = $extra.encryptedData | default dict -}}
{{- end -}}
{{- $entries = append $entries (dict "label" (printf "extraSecrets.%s.encryptedData" $name) "data" $data "forced" (and $migration (eq $name "migrator"))) -}}
{{- end -}}
{{- $needCa := $migration -}}
{{- range $entry := $entries -}}
{{- $hasDb := false -}}
{{- range $key, $_ := $entry.data -}}
{{- if and (hasPrefix "DB_" $key) $_ -}}
{{- $hasDb = true -}}
{{- end -}}
{{- end -}}
{{- if or $hasDb $entry.forced -}}
{{- $needCa = true -}}
{{- $missing := list -}}
{{- range $key := splitList " " (include "app.dbKeys" $) -}}
{{- if not (get $entry.data $key) -}}
{{- $missing = append $missing $key -}}
{{- end -}}
{{- end -}}
{{- if $missing -}}
{{- fail (printf "%s must carry all of %s; missing: %s" $entry.label (include "app.dbKeys" $ | replace " " ", ") (join ", " $missing)) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if and $needCa (not .Values.dbCa.pem) -}}
{{- fail "dbCa.pem is required when the application has database secrets or the migration is on: the PEM text of the DigitalOcean CA (ADR-053 item 5, ADR-061)" -}}
{{- end -}}
{{- end -}}

{{- define "app.rateLimitName" -}}
{{- printf "%s-rate-limit" (include "app.fullname" .) -}}
{{- end -}}
