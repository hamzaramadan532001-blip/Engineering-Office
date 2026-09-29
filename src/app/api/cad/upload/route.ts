import { NextResponse } from "next/server";

const GP_SERVER_URL =
  process.env.NEXT_PUBLIC_CAD_GP_SERVER_URL ??
  "https://maps.holymakkah.gov.sa/arcgis/rest/services/GP/cadToGeoJSON_GP/GPServer";

const ARCGIS_SERVER_TOKEN = process.env.ARCGIS_SERVER_TOKEN;

export async function POST(request: Request) {
  try {
    if (!ARCGIS_SERVER_TOKEN) {
      return NextResponse.json(
        {
          error: "ARCGIS_SERVER_TOKEN غير موجود في .env.local",
        },
        { status: 500 },
      );
    }

    // --------------------------------------------------
    // 1. Get CAD file from browser
    // --------------------------------------------------

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "لم يتم إرسال ملف CAD",
        },
        { status: 400 },
      );
    }

    console.log("[CAD] Starting upload:", file.name);
    console.log("[CAD] File size:", file.size, "bytes");

    // --------------------------------------------------
    // 2. Upload CAD to ArcGIS Server
    // --------------------------------------------------

    const uploadFormData = new FormData();

    uploadFormData.append(
      "file",
      file,
      file.name,
    );

    uploadFormData.append(
      "description",
      `CAD upload - ${file.name}`,
    );

    const uploadUrl =
      `${GP_SERVER_URL}/uploads/upload` +
      `?f=json&token=${encodeURIComponent(
        ARCGIS_SERVER_TOKEN,
      )}`;

    console.log(
      "[CAD] Upload URL:",
      `${GP_SERVER_URL}/uploads/upload`,
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: uploadFormData,
    });

    const uploadContentType =
      uploadResponse.headers.get("content-type") ?? "";

    const uploadText =
      await uploadResponse.text();

    console.log(
      "[CAD] Upload HTTP status:",
      uploadResponse.status,
    );

    console.log(
      "[CAD] Upload content-type:",
      uploadContentType,
    );

    console.log(
      "[CAD] Upload response:",
      uploadText,
    );

    if (!uploadResponse.ok) {
      return NextResponse.json(
        {
          error: "ArcGIS Upload فشل",
          status: uploadResponse.status,
          details: uploadText.slice(0, 3000),
        },
        { status: 502 },
      );
    }

    // --------------------------------------------------
    // 3. Extract Item ID
    // --------------------------------------------------

    let itemId: string | null = null;

    // JSON response
    if (
      uploadContentType.includes(
        "application/json",
      )
    ) {
      try {
        const uploadJson =
          JSON.parse(uploadText);

        console.log(
          "[CAD] Upload JSON:",
          uploadJson,
        );

        if (uploadJson.error) {
          return NextResponse.json(
            {
              error:
                "ArcGIS Upload Error",
              details:
                uploadJson.error,
            },
            { status: 502 },
          );
        }

        itemId =
          uploadJson?.item?.itemID ??
          uploadJson?.itemID ??
          null;
      } catch {
        console.log(
          "[CAD] Failed to parse JSON upload response",
        );
      }
    }

    // HTML response
    if (
      !itemId &&
      uploadContentType.includes(
        "text/html",
      )
    ) {
      console.log(
        "[CAD] ArcGIS returned HTML upload page.",
      );

      console.log(
        "[CAD] Extracting Item ID...",
      );

      /*
       * ArcGIS returns HTML like:
       *
       * <td>Item ID:</td>
       * <td>
       *   <a href=".../uploads/i822a5760-...">
       *     i822a5760-...
       *   </a>
       * </td>
       *
       * We specifically search for "Item ID"
       * so we don't accidentally extract
       * "upload" from the breadcrumb.
       */

      const itemIdMatch =
        uploadText.match(
          /<td>\s*Item ID:\s*<\/td>\s*<td>\s*<a[^>]*\/uploads\/(i[a-f0-9-]+)"[^>]*>\s*i[a-f0-9-]+\s*<\/a>/i,
        );

      if (itemIdMatch?.[1]) {
        itemId =
          itemIdMatch[1];

        console.log(
          "[CAD] Extracted Item ID:",
          itemId,
        );
      }
    }

    // --------------------------------------------------
    // 4. Validate Item ID
    // --------------------------------------------------

    if (!itemId) {
      console.error(
        "[CAD] Could not extract Item ID",
      );

      return NextResponse.json(
        {
          error:
            "لم أستطع استخراج Item ID من ArcGIS Server",
          details:
            uploadText.slice(0, 3000),
        },
        { status: 502 },
      );
    }

    console.log(
      "[CAD] Final Item ID:",
      itemId,
    );

    // --------------------------------------------------
    // 5. Build uploaded file URL
    // --------------------------------------------------

    const uploadedFileUrl =
      `${GP_SERVER_URL}/uploads/${itemId}`;

    console.log(
      "[CAD] Uploaded file URL:",
      uploadedFileUrl,
    );

    // --------------------------------------------------
    // 6. Execute CAD -> GeoJSON GP task
    // --------------------------------------------------

    const executeUrl =
      `${GP_SERVER_URL}/cadToGeoJSON/execute`;

    const executeFormData =
      new URLSearchParams();

    /*
     * GPDataFile accepts an uploaded ArcGIS
     * Server item using itemID.
     */

    executeFormData.append(
      "CAD_File",
      JSON.stringify({
        itemID: itemId,
      }),
    );

    executeFormData.append(
      "f",
      "json",
    );

    executeFormData.append(
      "token",
      ARCGIS_SERVER_TOKEN,
    );

    console.log(
      "[CAD] Executing GP task...",
    );

    console.log(
      "[CAD] Execute URL:",
      executeUrl,
    );

    console.log(
      "[CAD] Item ID:",
      itemId,
    );

    const executeResponse =
      await fetch(executeUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          executeFormData.toString(),
      });

    const executeContentType =
      executeResponse.headers.get(
        "content-type",
      ) ?? "";

    const executeText =
      await executeResponse.text();

    console.log(
      "[CAD] Execute HTTP status:",
      executeResponse.status,
    );

    console.log(
      "[CAD] Execute content-type:",
      executeContentType,
    );

    console.log(
      "[CAD] Execute response:",
      executeText.slice(0, 5000),
    );

    // --------------------------------------------------
    // 7. Check Execute HTTP response
    // --------------------------------------------------

    if (!executeResponse.ok) {
      return NextResponse.json(
        {
          error:
            "ArcGIS GP Execute فشل",
          status:
            executeResponse.status,
          details:
            executeText.slice(0, 5000),
        },
        { status: 502 },
      );
    }

    // --------------------------------------------------
    // 8. Parse Execute JSON
    // --------------------------------------------------

    let executeJson: any;

    try {
      executeJson =
        JSON.parse(executeText);
    } catch {
      return NextResponse.json(
        {
          error:
            "ArcGIS Execute رجع Response غير JSON",
          details:
            executeText.slice(0, 5000),
        },
        { status: 502 },
      );
    }

    console.log(
      "[CAD] Execute JSON:",
      executeJson,
    );

    // --------------------------------------------------
    // 9. Check ArcGIS GP error
    // --------------------------------------------------

    if (executeJson.error) {
      console.error(
        "[CAD] GP Error:",
        executeJson.error,
      );

      return NextResponse.json(
        {
          error:
            "فشل تحويل CAD إلى GeoJSON",
          details:
            executeJson.error,
        },
        { status: 502 },
      );
    }

    // --------------------------------------------------
    // 9b. Capture GP job messages
    // --------------------------------------------------
    //
    // `executeJson.error` only fires when the GP task itself fails to run.
    // A task that runs successfully but finds nothing convertible (entities
    // on a frozen/off layer, an unsupported entity type, a CAD file with no
    // spatial reference the service recognises, etc.) completes normally and
    // just returns an empty GeoJSON_Result — with the actual reason living in
    // `messages`, which this route was dropping entirely. Surfacing it here
    // turns "GeoJSON_Result فارغ" from a dead end into an answerable question.
    const gpMessages: Array<{ type?: string; description?: string }> = Array.isArray(
      executeJson?.messages,
    )
      ? executeJson.messages
      : [];

    if (gpMessages.length > 0) {
      console.log("[CAD] GP job messages:", gpMessages);
    }

    // --------------------------------------------------
    // 10. Get GeoJSON_Result
    // --------------------------------------------------

    const geoJsonResult =
      executeJson?.results?.find(
        (result: any) =>
          result?.paramName ===
          "GeoJSON_Result",
      );

    if (!geoJsonResult) {
      console.error(
        "[CAD] GeoJSON_Result not found",
      );

      return NextResponse.json(
        {
          error:
            "ArcGIS لم يرجع GeoJSON_Result",
          details:
            executeJson,
          gpMessages,
        },
        { status: 502 },
      );
    }

    // --------------------------------------------------
    // 11. Extract GeoJSON value
    // --------------------------------------------------

    const resultValue =
      geoJsonResult.value;

    const geojson =
      typeof resultValue ===
      "string"
        ? resultValue
        : resultValue?.value ??
          resultValue;

    if (!geojson) {
      console.error(
        "[CAD] GeoJSON value is empty",
      );

      // ArcGIS completed the conversion job but found nothing to convert.
      // This is NOT the upload/execute pipeline failing — itemId + execute
      // both succeeded above. It means the CAD file itself has no entities
      // the service could turn into geometry. gpMessages (if the service
      // returned any) usually names the actual reason: an unsupported entity
      // type, a layer that's frozen/off, or a missing/unrecognised spatial
      // reference on the CAD dataset.
      return NextResponse.json(
        {
          error:
            "GeoJSON_Result فارغ — الملف اتقرا لكن مفيهوش أي عناصر قابلة للتحويل",
          details:
            geoJsonResult,
          gpMessages,
        },
        { status: 502 },
      );
    }

    // --------------------------------------------------
    // 12. Success
    // --------------------------------------------------

    console.log(
      "[CAD] GeoJSON conversion successful",
    );

    console.log(
      "[CAD] GeoJSON length:",
      typeof geojson ===
      "string"
        ? geojson.length
        : "unknown",
    );

    return NextResponse.json({
      success: true,
      itemId,
      geojson,
    });
  } catch (error) {
    // --------------------------------------------------
    // Unexpected error
    // --------------------------------------------------

    console.error(
      "[CAD] Unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "حدث خطأ أثناء معالجة ملف CAD",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}