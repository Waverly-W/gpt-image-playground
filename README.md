# <img src="./public/favicon.svg" alt="Project Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT Image Playground

A web-based playground to interact with OpenAI's GPT image models (`gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, and `gpt-image-1-mini`) for generating and editing images.

> **Note:** The playground defaults to `gpt-image-2`, OpenAI's latest GPT image model. It supports arbitrary resolutions up to 4K (with constraint validation) in addition to the legacy fixed sizes.

<p align="center">
  <img src="./readme-images/interface.jpg" alt="Interface" width="600"/>
</p>

## ✨ Features

- **🎨 Image Generation Mode:** Create new images from text prompts.
- **🖌️ Image Editing Mode:** Modify existing images based on text prompts and optional masks.
- **⚙️ Full API Parameter Control:** Access and adjust all relevant parameters supported by the OpenAI Images API directly through the UI (size, quality, output format, compression, background, moderation, number of images).
- **📐 Custom Resolutions (gpt-image-2):** Pick from 2K/4K presets or enter an arbitrary Width × Height with live validation against the model's constraints (multiples of 16, max 3840px per edge, ≤ 3:1 aspect ratio, 655,360 to 8,294,400 total pixels).
- **🎭 Integrated Masking Tool:** Easily create or upload masks directly within the editing mode to specify areas for modification. Draw directly on the image to generate a mask.

           > ⚠️ Please note that `gpt-image-1`'s masking feature does not guarantee 100% control at this time. <br>1) [It's a known & acknowledged model limitation.](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37) <br>2) [OpenAI are looking to address it in a future update.](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)

      <p align="center">
        <img src="./readme-images/mask-creation.jpg" alt="Interface" width="350"/>
      </p>

- **📜 Detailed History & Cost Tracking:**
    - View a comprehensive history of all your image generations and edits.
    - See the parameters used for each request.
    - Get detailed API token usage and estimated cost breakdowns (`$USD`) for each operation. (hint: click the `$` amount on the image)
    - View the full prompt used for each history item.
    - View total historical API cost.
    - Delete items from history

<p align="center">
  <img src="./readme-images/history.jpg" alt="Interface" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="Interface" width="350"/>
</p>

- **🖼️ Flexible Image Output View:** View generated image batches as a grid or select individual images for a closer look.
- **🚀 Send to Edit:** Quickly send any generated or history image directly to the editing form.
- **📋 Paste to Edit:** Paste images directly from your clipboard into the Edit mode's source image area.
- **💾 Storage:** Supports three modes from the admin configuration panel:
    - **Filesystem (default):** Images saved to `./generated-images` on the server.
    - **IndexedDB:** Images saved directly in the browser's IndexedDB (ideal for serverless deployments).
    - **Cloudflare R2:** Images saved to a private R2 bucket and served through the app's authenticated `/api/image/:filename` route.
    - Generation history metadata is always saved in the browser's local storage.

## ▲ Deploy to Vercel

🚨 _CAUTION: If you deploy from `main` or `master` branch, your Vercel deployment will be **publicly available** to anyone who has the URL. Deploying from other branches will require users to be logged into Vercel (on your team) to access the preview build._ 🚨

You can deploy your own instance of this playground to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alasano/gpt-image-1-playground&env=ADMIN_EMAIL,ADMIN_PASSWORD,JWT_SECRET&envDescription=Administrator%20credentials%20and%20JWT%20secret%20are%20required.%20OpenAI%20and%20storage%20settings%20are%20configured%20in%20the%20admin%20panel.&project-name=gpt-image-playground&repository-name=gpt-image-playground)

You will be prompted to enter admin account variables during deployment. After logging in as the administrator, open `/admin` to configure the OpenAI API key, custom API base URL, image storage mode, R2 credentials, registration, and cookie behavior. These settings are persisted in SQLite.

## 🚀 Getting Started [Local Deployment]

Follow these steps to get the playground running locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 20 or later required)
- [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/)

### 1. Configure Accounts 🟢

The app uses cookie-based login with an environment-managed administrator and SQLite-backed regular users.

```dotenv
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
JWT_SECRET=use-a-long-random-string
```

`AUTH_SECRET` can be used instead of `JWT_SECRET`. `SQLITE_DB_PATH` is optional if you want to move the SQLite database from the default `./data/app.db`.

After the first admin login, configure runtime settings from `/admin`.

⚠️ [Your OpenAI Organization needs to be verified to use GPT Image models](https://help.openai.com/en/articles/10910291-api-organization-verification)

---

#### 🟡 Runtime Settings

The following settings are managed from the administrator panel and persisted to the `app_settings` SQLite table:

- OpenAI API key
- OpenAI-compatible base URL
- Image storage mode: automatic, filesystem, IndexedDB, or Cloudflare R2
- Cloudflare R2 account ID, access key, secret key, bucket, and optional endpoint
- Registration enabled
- Auth cookie secure policy

Legacy environment variables for these values are still read as fallback values when the database setting is empty, but new deployments should use the admin panel.

When storage mode is set to `indexeddb`:

- The server API (`/api/images`) will return the image data as base64 (`b64_json`) instead of saving it to disk.
- The client-side application will decode the base64 data and store the image blob in IndexedDB.
- Images will be served directly from the browser's storage using Blob URLs.

When storage mode is set to `r2`, the server stores images in a private Cloudflare R2 bucket using Cloudflare's S3-compatible API. Images are still read through the authenticated `/api/image/:filename` route, so normal user ownership checks continue to apply.

Regular users can register when registration is enabled, and administrators can manage users from `/admin`.

---

### 2. Install Dependencies 🟢

Navigate to the project directory in your terminal and install the necessary packages:

```bash
npm install
# or
# yarn install
# or
# pnpm install
# or
# bun install
```

### 3. Run the Development Server 🟢

Start the Next.js development server:

```bash
npm run dev
# or
# yarn dev
# or
# pnpm dev
# or
# bun dev
```

### 4. Open the Playground 🟢

Open [http://localhost:3000](http://localhost:3000) in your web browser. You should now be able to use the gpt-image-1 Playground!

## 🤝 Contributing

Contributions are welcome! Issues and feature requests, not as much welcome but I'll think about it.

## 📄 License

MIT
