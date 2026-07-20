// Log __dirname and __filename
console.log('__dirname:', __dirname);
console.log('__filename:', __filename);

// Log process ID and platform
console.log('Process ID:', process.pid); // Log the current Node process ID assigned by OS
console.log('Platform:', process.platform); // Log the operating system platform

// Attach a custom property to global and log it
global.myCustomVar = 'Hello, global!';
console.log('Custom global variable:', global.myCustomVar);
