const fs = require("fs");
const path = require("path");


// Write a sample file for demonstration
const sampleFilePath = path.join(
  __dirname,
  'sample-files',
  'sample.txt',
);

const sampleContent = 'Hello, async world!';

// 1. Callback style
/*
Callback hell happens when asynchronous operations are deeply nested
inside other callbacks. This makes the code difficult to read,
maintain, and debug because every operation depends on the previous
operation.

  // Callback hell example (test and leave it in comments):

  fs.readFile('first.txt', 'utf8', (firstError, firstData) => {
  if (firstError) {
    return;
  }

  fs.readFile('second.txt', 'utf8', (secondError, secondData) => {
    if (secondError) {
      return;
    }

    fs.writeFile(
      'result.txt',
      firstData + secondData,
      (writeError) => {
        if (writeError) {
          return;
        }

        console.log('Nested operations finished.');
      },
    );
  });
});

Promises and async/await help avoid this deeply nested structure.
*/


// Callback version of fs.readFile.
// The Promise returned here only allows runDemo() to wait until
// the callback demonstration finishes.
function readUsingCallback(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      console.log('Callback read:', data);
      resolve();
    });
  });
}

// Promise version created by wrapping fs.readFile.
function readUsingPromise(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data);
    });
  });
}

// Async/await version using Node's Promise-based file-system API.
async function readUsingAsyncAwait(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');
  console.log('Async/Await read:', data);
}

async function runDemo() {
  try {
    // Ensure that the sample-files directory exists.
    await fs.promises.mkdir(path.dirname(sampleFilePath), {
      recursive: true,
    });

    // Create sample.txt programmatically with the exact required content.
    await fs.promises.writeFile(
      sampleFilePath,
      sampleContent,
      'utf8',
    );

    // 1. Callback style
    await readUsingCallback(sampleFilePath);

    // 2. Promise style
    await readUsingPromise(sampleFilePath).then((data) => {
      console.log('Promise read:', data);
    });

    // 3. Async/Await style
    await readUsingAsyncAwait(sampleFilePath);
  } catch (error) {
    console.error('Async demo failed:', error.message);
  }
}

runDemo();