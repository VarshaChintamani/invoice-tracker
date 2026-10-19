const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const { performOCR } = require("../services/ocrService");

const createTemporaryImage = async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "invoice-ocr-cleanup-")
  );
  const imagePath = path.join(directory, "source.png");

  await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).png().toFile(imagePath);

  return {
    directory,
    imagePath,
    processedPath: path.join(directory, "source-processed.png"),
  };
};

const withQuietConsole = async (action) => {
  const originalError = console.error;
  console.error = () => {};

  try {
    return await action();
  } finally {
    console.error = originalError;
  }
};

test("removes preprocessing output when worker creation fails", async () => {
  const temporary = await createTemporaryImage();
  const originalCreateWorker = Tesseract.createWorker;
  const workerCreationError = new Error("synthetic worker creation failure");
  let preprocessingCompleted = false;

  Tesseract.createWorker = async () => {
    preprocessingCompleted = fs.existsSync(temporary.processedPath);
    throw workerCreationError;
  };

  try {
    await withQuietConsole(() => assert.rejects(
      performOCR(temporary.imagePath),
      (error) => error === workerCreationError
    ));

    assert.equal(preprocessingCompleted, true);
    assert.equal(fs.existsSync(temporary.processedPath), false);
  } finally {
    Tesseract.createWorker = originalCreateWorker;
    fs.rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test("terminates a created worker and removes preprocessing output after recognition fails", async () => {
  const temporary = await createTemporaryImage();
  const originalCreateWorker = Tesseract.createWorker;
  const recognitionError = new Error("synthetic recognition failure");
  const cleanupError = new Error("synthetic worker cleanup failure");
  let terminateCalls = 0;
  let preprocessingCompleted = false;

  Tesseract.createWorker = async () => {
    preprocessingCompleted = fs.existsSync(temporary.processedPath);
    return {
      setParameters: async () => {},
      recognize: async () => {
        throw recognitionError;
      },
      terminate: async () => {
        terminateCalls += 1;
        throw cleanupError;
      },
    };
  };

  try {
    await withQuietConsole(() => assert.rejects(
      performOCR(temporary.imagePath),
      (error) => error === recognitionError
    ));

    assert.equal(preprocessingCompleted, true);
    assert.equal(terminateCalls, 1);
    assert.equal(fs.existsSync(temporary.processedPath), false);
  } finally {
    Tesseract.createWorker = originalCreateWorker;
    fs.rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test("does not let worker cleanup failure replace a successful OCR result", async () => {
  const temporary = await createTemporaryImage();
  const originalCreateWorker = Tesseract.createWorker;
  let terminateCalls = 0;

  Tesseract.createWorker = async () => ({
    setParameters: async () => {},
    recognize: async () => ({ data: { text: "synthetic OCR result" } }),
    terminate: async () => {
      terminateCalls += 1;
      throw new Error("synthetic worker cleanup failure");
    },
  });

  try {
    const text = await withQuietConsole(() => performOCR(temporary.imagePath));

    assert.equal(text, "synthetic OCR result");
    assert.equal(terminateCalls, 1);
    assert.equal(fs.existsSync(temporary.processedPath), false);
  } finally {
    Tesseract.createWorker = originalCreateWorker;
    fs.rmSync(temporary.directory, { recursive: true, force: true });
  }
});