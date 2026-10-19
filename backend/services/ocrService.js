// const Tesseract = require("tesseract.js");

// const performOCR = async (
//   imagePath
// ) => {
//   console.log(
//     "Starting OCR..."
//   );

//   const result =
//     await Tesseract.recognize(
//       imagePath,
//       "eng",
//       {
//         logger: (info) => {
//           if (
//             info.status ===
//             "recognizing text"
//           ) {
//             console.log(
//               `OCR Progress: ${Math.round(
//                 info.progress * 100
//               )}%`
//             );
//           }
//         },
//       }
//     );

//   return result.data.text;
// };

// module.exports = {
//   performOCR,
// };

const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const performOCR = async (imagePath) => {
  const parsedPath = path.parse(imagePath);
  const processedImagePath = path.join(
    parsedPath.dir,
    `${parsedPath.name}-processed.png`
  );
  let worker;

  try {
    await sharp(imagePath)
      // Increase resolution for better character recognition
      .resize({
        width: 2000,
        withoutEnlargement: false,
        fit: "inside",
      })

      // Convert to grayscale
      .grayscale()

      // Improve contrast
      .normalize()

      // Slight sharpening
      .sharpen({
        sigma: 1.5,
      })

      // Convert to PNG
      .png()
      .toFile(processedImagePath);

    worker = await Tesseract.createWorker("eng", 1, {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(
            `OCR Progress: ${Math.round(
              info.progress * 100
            )}%`
          );
        }
      },
    });

    await worker.setParameters({
      // Automatic page segmentation
      tessedit_pageseg_mode: "3",

      // Preserve spaces between words
      preserve_interword_spaces: "1",

      // Tell Tesseract the image resolution
      user_defined_dpi: "300",
    });

    const result = await worker.recognize(
      processedImagePath
    );

    return result.data.text;
  } catch (error) {
    console.error("OCR failed.");
    throw error;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        console.error("OCR worker cleanup failed.");
      }
    }

    try {
      await fs.promises.unlink(processedImagePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("OCR image cleanup failed.");
      }
    }
  }
};

module.exports = {
  performOCR,
};