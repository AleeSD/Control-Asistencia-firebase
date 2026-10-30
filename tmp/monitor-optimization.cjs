const fs = require('fs');
const path = require('path');
const auth = require('C:/Users/transporte.ope3/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
const project = 'sistema-de-asistencia-os';
async function main() {
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('Autenticación CLI no disponible.');
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  async function get(url) {
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token.access_token } });
    if (!response.ok) return { status: response.status };
    return response.json();
  }
  const end = new Date(Date.now() - 5 * 60000);
  const start = new Date(end - 48 * 3600000);
  const metrics = {};
  const descriptors = await get('https://monitoring.googleapis.com/v3/projects/' + project + '/metricDescriptors?' + new URLSearchParams({ filter: 'metric.type = starts_with("firestore.googleapis.com/")' }));
  const types = descriptors.metricDescriptors?.map(d => d.type) ?? [];
  const selected = types.filter(t => /document\/(read_count|write_count|delete_count)$|snapshot_listeners$|active_connections$|rules.*(evaluation|request)/.test(t));
  for (const type of selected) {
    const gauge = /snapshot_listeners$|active_connections$/.test(type);
    const params = new URLSearchParams({ filter: 'metric.type="' + type + '"', 'interval.startTime': start.toISOString(), 'interval.endTime': end.toISOString(), 'aggregation.alignmentPeriod': '86400s', 'aggregation.perSeriesAligner': gauge ? 'ALIGN_MAX' : 'ALIGN_SUM', view: 'FULL' });
    metrics[type] = await get('https://monitoring.googleapis.com/v3/projects/' + project + '/timeSeries?' + params);
  }
  const publicResponse = await fetch('https://sistema-de-asistencia-os.web.app');
  const html = await publicResponse.text();
  const asset = html.match(/src="([^\"]+\.js)"/);
  let assetStatus = null;
  if (asset) assetStatus = (await fetch(new URL(asset[1], publicResponse.url))).status;
  const summary = {};
  for (const [type, body] of Object.entries(metrics)) {
    const windows = {};
    const allSeries = body.timeSeries ?? [];
    const databaseSeries = allSeries.filter(s => s.resource?.type === 'firestore.googleapis.com/Database');
    const selectedSeries = databaseSeries.length ? databaseSeries : allSeries;
    const results = {};
    for (const series of selectedSeries) for (const point of series.points ?? []) {
      const key = point.interval.endTime;
      const value = Number(point.value.int64Value ?? point.value.doubleValue ?? 0);
      const gauge = /snapshot_listeners$|active_connections$/.test(type);
      windows[key] = gauge ? Math.max(windows[key] ?? 0, value) : (windows[key] ?? 0) + value;
      const outcome = series.metric.labels.result;
      if (outcome) { results[key] ??= {}; results[key][outcome] = (results[key][outcome] ?? 0) + value; }
    }
    summary[type] = body.status ? { status: body.status } : { windows, results, series: selectedSeries.length, resourceType: selectedSeries[0]?.resource?.type ?? null };
  }
  const result = { at: new Date().toISOString(), windowNote: 'Ventanas móviles de 24 horas; corte cinco minutos antes de la medición. No son días de cuota.', start: start.toISOString(), end: end.toISOString(), descriptorStatus: descriptors.status ?? 200, availableMetricTypes: types, publicStatus: publicResponse.status, assetStatus, summary, metrics };
  const dir = path.join('tmp', 'optimization-monitoring'); fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, result.at.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ filename, at: result.at, start: result.start, end: result.end, descriptorStatus: result.descriptorStatus, publicStatus: result.publicStatus, assetStatus, summary, rulesMetricTypes: types.filter(t => /rules/.test(t)) }));
}
main().catch(() => { console.error('No se pudo obtener la medición: revisar disponibilidad del entorno o autenticación CLI.'); process.exitCode = 1; });
