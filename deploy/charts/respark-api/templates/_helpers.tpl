{{- define "respark-api.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: respark
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "respark-api.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "respark-api.devVolumeMounts" -}}
{{- if .Values.devMounts }}
volumeMounts:
  {{- range $i, $path := .Values.devMounts }}
  - name: dev-src-{{ $i }}
    mountPath: /repo/{{ $path }}
  {{- end }}
{{- end }}
{{- end }}

{{- define "respark-api.devVolumes" -}}
{{- if .Values.devMounts }}
{{- $root := trimSuffix "/" (required "repoRoot is required when devMounts is set" .Values.repoRoot) }}
volumes:
  {{- range $i, $path := .Values.devMounts }}
  - name: dev-src-{{ $i }}
    hostPath:
      path: {{ printf "%s/%s" $root $path }}
  {{- end }}
{{- end }}
{{- end }}
