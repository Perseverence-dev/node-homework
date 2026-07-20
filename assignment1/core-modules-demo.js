const os = require('os');
const path = require('path');
const fs = require('fs');


// OS module
console.log('Platform:', os.platform());
console.log('CPU:', os.cpus()[0].model);
console.log('Total Memory:', os.totalmem());

// Path module
const joinedPath = path.join(
  __dirname,
  'sample-files',
  'folder',
  'file.txt',
);

console.log('Joined path:', joinedPath);


// Create the path for the required demo file.
const demoFilePath = path.join(
  __dirname,
  'sample-files',
  'demo.txt',
);

const demoContent = 'Hello from fs.promises!';

async function demonstrateFileSystem() {
  try {
    // Ensure that the sample-files directory exists.
    await fs.promises.mkdir(path.dirname(demoFilePath), {
      recursive: true,
    });

    // Write the required content to demo.txt.
    await fs.promises.writeFile(
      demoFilePath,
      demoContent,
      'utf8',
    );

    // Read demo.txt after writing finishes.
    const fileContent = await fs.promises.readFile(
      demoFilePath,
      'utf8',
    );

    console.log('fs.promises read:', fileContent);
  } catch (error) {
    console.error('File operation failed:', error.message);
  }
}

demonstrateFileSystem();

// fs.promises API


// Streams for large files- log first 40 chars of each chunk
