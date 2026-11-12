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

{{- define "app.env" -}}
{{- range $name, $value := .Values.env }}
- name: {{ $name }}
  value: {{ $value | quote }}
{{- end }}
{{- end -}}

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

{{- define "app.tmpVolumeMount" -}}
- name: tmp
  mountPath: /tmp
{{- end -}}

{{- define "app.tmpVolume" -}}
- name: tmp
  emptyDir: {}
{{- end -}}
