const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

exec('netstat -ano | findstr :3000', { shell: true }, (err, stdout, stderr) => {
  console.log('NETSTAT OUTPUT:');
  console.log(stdout || stderr || err?.message);
  exec('tasklist /FI "IMAGENAME eq node.exe" /FO LIST', { shell: true }, (err2, stdout2, stderr2) => {
    console.log('NODE TASKLIST:');
    console.log(stdout2 || stderr2 || err2?.message);
    const logPath = path.join('C:', 'MULTICOM', 'server_stdout.log');
    try {
      const content = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-40).join('\n');
      console.log('SERVER_STDOUT LOG TAIL:');
      console.log(content);
    } catch (readErr) {
      console.error('LOG READ ERROR', readErr.message);
    }
  });
});
