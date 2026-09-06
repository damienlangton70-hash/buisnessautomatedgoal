/**
 * Image generation providers.
 *
 * History worth keeping: this file exists because the pipeline has twice
 * shipped an endpoint nobody verified. The itch.io uploader POSTed to a URL
 * that does not exist, and the Hugging Face swap called
 * `api-inference.huggingface.co`, the retired serverless endpoint, which
 * failed on every image while the run reported success. Both endpoints below
 * were checked against the provider's own current documentation before being
 * written down.
 *
 * Providers are selected with IMAGE_PROVIDER. Each returns PNG bytes for a
 * square image, and each throws loudly rather than returning anything a
 * caller could mistake for a picture.
 */

/** Square edge length requested from the provider, before downscaling. */
export const SOURCE_SIZE = 1024;

const PROVIDERS = {
  /**
   * fal.ai — https://fal.run/fal-ai/flux-2-pro
   * Synchronous: the request blocks until the image is ready, so there is no
   * queue to poll. Auth is `Authorization: Key <FAL_KEY>`.
   */
  fal: {
    id: "fal:flux-2-pro",
    envKey: "FAL_KEY",
    // ~$0.03/image at the time of writing. Verify against fal.ai/pricing.
    costPerImageUsd: 0.03,
    async generate(prompt, apiKey) {
      const response = await fetch("https://fal.run/fal-ai/flux-2-pro", {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_size: "square_hd",
          output_format: "png",
          enable_safety_checker: true,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `fal.ai returned ${response.status}: ${await safeText(response)}`,
        );
      }

      const body = await response.json();
      const url = body?.images?.[0]?.url;
      if (!url) {
        throw new Error(
          `fal.ai returned no image URL. Body: ${JSON.stringify(body).slice(0, 300)}`,
        );
      }
      return downloadPng(url);
    },
  },

  /**
   * Black Forest Labs direct — https://api.bfl.ai/v1/flux-2-pro
   * Asynchronous: submit, then poll `polling_url` until status is "Ready".
   * Auth is the `x-key` header. Result URLs expire after 10 minutes.
   */
  bfl: {
    id: "bfl:flux-2-pro",
    envKey: "BFL_API_KEY",
    costPerImageUsd: 0.04,
    async generate(prompt, apiKey) {
      const submit = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
        method: "POST",
        headers: { "x-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          width: SOURCE_SIZE,
          height: SOURCE_SIZE,
        }),
      });

      if (!submit.ok) {
        throw new Error(
          `BFL submit returned ${submit.status}: ${await safeText(submit)}`,
        );
      }

      const { polling_url: pollingUrl } = await submit.json();
      if (!pollingUrl) throw new Error("BFL returned no polling_url");

      // Signed result URLs live 10 minutes, so a 2-minute ceiling is ample.
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await sleep(1500);
        const poll = await fetch(pollingUrl, { headers: { "x-key": apiKey } });
        if (!poll.ok) continue;

        const state = await poll.json();
        if (state.status === "Ready") {
          const url = state.result?.sample;
          if (!url) throw new Error("BFL reported Ready with no result.sample");
          return downloadPng(url);
        }
        if (["Error", "Content Moderated", "Request Moderated"].includes(state.status)) {
          throw new Error(`BFL failed: ${state.status}`);
        }
      }
      throw new Error("BFL timed out after 120s");
    },
  },

  /**
   * OpenAI DALL-E 3. Kept as a fallback: it works, but on game art it is
   * visibly weaker than FLUX and costs roughly three times as much.
   */
  openai: {
    id: "openai:dall-e-3",
    envKey: "OPENAI_API_KEY",
    costPerImageUsd: process.env.IMAGE_QUALITY === "standard" ? 0.04 : 0.08,
    async generate(prompt, apiKey) {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: `${SOURCE_SIZE}x${SOURCE_SIZE}`,
          quality: process.env.IMAGE_QUALITY || "hd",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI returned ${response.status}: ${await safeText(response)}`,
        );
      }

      const body = await response.json();
      const url = body?.data?.[0]?.url;
      if (!url) throw new Error("OpenAI returned no image URL");
      return downloadPng(url);
    },
  },
};

async function downloadPng(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // A provider that answers 200 with an error page would otherwise be written
  // to disk as a .png and sail through the rest of the pipeline.
  if (buffer.length < 1024) {
    throw new Error(`Image download returned only ${buffer.length} bytes`);
  }
  return buffer;
}

async function safeText(response) {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "<no body>";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the configured provider and its API key.
 * Throws with actionable text if either is missing.
 */
export function resolveProvider(name = process.env.IMAGE_PROVIDER || "fal") {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown IMAGE_PROVIDER "${name}". Options: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(
      `${provider.envKey} is not set, which IMAGE_PROVIDER="${name}" requires. See .env.example`,
    );
  }

  return {
    ...provider,
    generate: (prompt) => provider.generate(prompt, apiKey),
  };
}

export function listProviders() {
  return Object.keys(PROVIDERS);
}
