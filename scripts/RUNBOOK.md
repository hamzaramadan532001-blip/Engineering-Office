# Makkah GIS Viewer: Deployment Runbook (Windows Server / IIS)

The release is a self-contained Next.js server (`server.js` plus its `node_modules`).
IIS sits in front as a reverse proxy. The app is served under the sub-path
**`/gis-viewer-eng`**, e.g. `https://qamaps.holymakkah.gov.sa/gis-viewer-eng/login`.

## 1. Prerequisites (once per server)

| Item | Requirement |
| --- | --- |
| Node.js | **24 LTS** (22.15 or newer at minimum), 64-bit, installed for all users |
| IIS modules | **URL Rewrite** and **Application Request Routing (ARR)**, with ARR proxy enabled (IIS Manager → server → ARR Cache → Server Proxy Settings → *Enable proxy*) |
| Network | The server must reach `maps.holymakkah.gov.sa`, `geoportal.holymakkah.gov.sa` and `sdi.holymakkah.gov.sa` on 443 |
| Port | 3005 free locally (the Node server; only IIS talks to it) |

To check network access from the server, run in PowerShell:

```powershell
Test-NetConnection maps.holymakkah.gov.sa -Port 443
```

## 2. Build (on the build machine)

```bash
pnpm install
pnpm build:windows        # stop `pnpm dev` first: both write to .next
```

Output: `build/gis-viewer-winbuild.zip`. It contains no secrets. `.env.example` is only
a template.

## 3. Deploy

1. Stop the running app (see §5), then keep a copy of the current folder for rollback:
   `C:\inetpub\wwwroot\gis-viewer-eng` → `gis-viewer-eng.bak`.
2. Extract the ZIP and copy the **contents** of `gis-viewer-winbuild\` into
   `C:\inetpub\wwwroot\gis-viewer-eng\`.
3. Configure the environment:
   - First install: rename `.env.example` to **`.env`** and fill every REQUIRED value.
   - Upgrade: copy your existing `.env` back from the `.bak` folder.
   - **Make sure no `.env.local` is in the folder.** It overrides `.env`.
4. Start the app (see §5).

## 4. IIS reverse proxy

In the IIS site that serves `qamaps.holymakkah.gov.sa`, add this rule to the site's
`web.config`, or create it in IIS Manager under URL Rewrite:

```xml
<rewrite>
  <rules>
    <rule name="gis-viewer-eng" stopProcessing="true">
      <match url="^gis-viewer-eng(/.*)?$" />
      <action type="Rewrite" url="http://localhost:3005/gis-viewer-eng{R:1}" />
    </rule>
  </rules>
</rewrite>
```

Keep the `/gis-viewer-eng` prefix in the target URL. The app expects it.

## 5. Run the app

**Manual / testing:** double-click `start.cmd`. The window must stay open.

**As a Windows service (recommended):** use [NSSM](https://nssm.cc):

```powershell
mkdir C:\inetpub\wwwroot\gis-viewer-eng\logs
nssm install GisViewerEng "C:\Program Files\nodejs\node.exe" start.js
nssm set GisViewerEng AppDirectory C:\inetpub\wwwroot\gis-viewer-eng
nssm set GisViewerEng AppStdout C:\inetpub\wwwroot\gis-viewer-eng\logs\app.log
nssm set GisViewerEng AppStderr C:\inetpub\wwwroot\gis-viewer-eng\logs\app.log
nssm start GisViewerEng
```

Stop, start or restart with `nssm stop|start|restart GisViewerEng`. Restart after every
`.env` change.

Always launch through **`start.js`**, not `server.js`. `start.js` sets
`NODE_ENV=production`, sets the port (3005), and adds `--use-system-ca` so Node trusts
the Windows certificate store. If something runs `server.js` directly (e.g.
HttpPlatformHandler), set the environment variable `NODE_OPTIONS=--use-system-ca` there
yourself.

## 6. Verify

1. `http://localhost:3005/gis-viewer-eng/login` on the server returns the login page.
2. `https://<host>/gis-viewer-eng/login` from a client returns the same page.
3. Sign in with an engineering-office national number. You should reach the map.
4. Open **الطلبات**. The office's requests should load.
5. In the browser dev tools, no ArcGIS request returns `498` or `499`.

## 7. Troubleshooting

When login fails, the response body of `POST /gis-viewer-eng/api/auth/office-login`
(browser dev tools → Network → Response) and the app log name the cause:

| Symptom / message | Cause | Fix |
| --- | --- | --- |
| `ARCGIS_SERVER_TOKEN غير موجود` | `.env` missing, misnamed, or the value is empty | Fix `.env` and restart |
| `شهادة SSL للخادم غير موثوقة من Node` | Node doesn't trust the ArcGIS certificate (internal CA) | Launch via `start.js` (adds `--use-system-ca`), or install the CA in the Windows *Trusted Root* store |
| `تعذّر العثور على الخادم (DNS)` | The server can't resolve the ArcGIS host | Fix DNS / hosts file on the server |
| `الاتصال مرفوض أو محجوب` / `انتهت مهلة الاتصال` | Firewall or proxy blocks outbound 443 | Open outbound 443 to the ArcGIS hosts |
| `سجل المكاتب الهندسية: Invalid Token` | `ARCGIS_SERVER_TOKEN` expired or bound to another IP/Referer | Generate a token valid from this server and update `.env` |
| `هذا الرقم غير مسجل…` (404) | The number isn't in the office register | Expected behaviour |
| IIS `502.3` with an IIS error page (not JSON) | Node isn't running or is on another port | Start the service and check the port in §4 |
| Map layers or requests show `Invalid Token (498)` | Browser tokens are bound to a different address | Regenerate `ARCGIS_TOKEN` / `BUSINESS_MAP_TOKEN` for the public host |
| Page loads without styles, `/_next/...` 404 | The rewrite dropped the `/gis-viewer-eng` prefix | Use the rule in §4 exactly |

## 8. Rollback

Stop the app, delete `gis-viewer-eng`, rename `gis-viewer-eng.bak` back to
`gis-viewer-eng`, then start the app.
