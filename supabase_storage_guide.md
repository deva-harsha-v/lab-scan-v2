# 📹 LabScan Direct Video Hosting Guide (Supabase Storage)

Google Drive iframe embeds are highly fragile on mobile devices because mobile browsers (iOS Safari, mobile Chrome/Brave) block third-party cookies and cross-site tracking by default. When a student taps Play on a Google Drive iframe, Google's media engine attempts to verify their session; if cookies are blocked, the player instantly blackouts.

To bypass this restriction completely and guarantee a **100% stable, high-performance mobile video player**, you can host your lab video files directly in your project's **Supabase Storage** bucket. This renders using the native browser HTML5 `<video>` player, loading instantly without any login or cookie prompts.

---

## 🛠️ Step 1: Create a Public Video Bucket in Supabase

1. Open your **Supabase Dashboard** (https://supabase.com).
2. In the left navigation bar, click on **Storage** (the bucket icon).
3. Click the **New Bucket** button.
4. Set the **Bucket Name** to `videos`.
5. Toggle **Public Bucket** to **ON** (this is critical so that students can stream the video without auth tokens).
6. Click **Save** to create the bucket.

---

## 📤 Step 2: Upload Your Lab Video

1. Click on your newly created `videos` bucket.
2. Click the **Upload File** button.
3. Select your lab demonstration video file (standard formats like `.mp4` are highly recommended for mobile compatibility).
4. Wait for the upload to complete.

---

## 🔗 Step 3: Copy the Direct Stream URL

1. Once uploaded, click the **three dots (...)** next to your video file in the file list.
2. Select **Get URL** or **Copy URL**.
3. The copied link will look like this:
   `https://xsdevzqcdczmfycjlcim.supabase.co/storage/v1/object/public/videos/your-video-file.mp4`
   *(Verify that the domain ends in `.supabase.co` and contains `/storage/v1/object/public/`)*

---

## 📝 Step 4: Paste into the LabScan Admin Panel

1. Log in as an **Admin** on your LabScan web app.
2. Go to the **Admin Dashboard** and edit the experiment (e.g. *Titration* or *Ohm's Law*).
3. In the **Visual Resources / Videos** section, replace the old Google Drive link with your copied Supabase Storage direct URL.
4. Click **Save Changes** and publish the version.

---

## 🚀 Why This is the Default Mobile Fallback
* **No Authentication Prompts**: Students do not need to sign in to Google or enable third-party cookies in their browser settings.
* **Responsive Fluid Sizing**: The native browser player respects the aspect ratio and viewport sizing flawlessly on iOS, Android, and tablets.
* **Precise Timer Gating**: The playback events (play, pause, seek, ended) communicate directly with the LabScan workspace page to increment the attendance countdown timer accurately.
