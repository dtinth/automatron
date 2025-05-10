import { type Html, html } from '@thai/html'

export function layout(options: { title: string | undefined; contents: Html }) {
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${options.title}</title>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
          crossorigin="anonymous"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
          crossorigin="anonymous"
        ></script>
        <script
          async
          src="https://cdn.jsdelivr.net/npm/iconify-icon@2.2.0/dist/iconify-icon.min.js"
        ></script>
        <script
          src="https://cdn.jsdelivr.net/npm/@github/relative-time-element@4.4.5/dist/relative-time-element-define.min.js"
          type="module"
          async
        ></script>
      </head>
      <body>
        <nav class="navbar border-bottom border-body">
          <div
            style="margin: 0 auto; max-width: 960px"
            class="container-fluid px-3 d-flex justify-content-between align-items-center"
          >
            <a href="/admin" class="navbar-brand mb-0 h1 text-decoration-none"
              >automatron</a
            >
          </div>
        </nav>
        <div class="p-3" style="margin: 0 auto; max-width: 960px" id="main">
          ${options.contents}
        </div>
      </body>
    </html>`
}
