let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => console.log(JSON.stringify({ args: process.argv.slice(2), input })));
