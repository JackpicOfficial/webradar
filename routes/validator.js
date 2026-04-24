const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');

router.post('/python', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const pyExe = process.platform === 'win32' ? 'python' : 'python3';
  const script = [
    'import ast, sys',
    'src = sys.stdin.read()',
    'try:',
    '    ast.parse(src)',
    '    print("valid")',
    'except SyntaxError as e:',
    '    print(f"error:{e.lineno}:{e.offset}:{e.msg}")',
  ].join('\n');

  const proc = spawn(pyExe, ['-c', script]);
  proc.stdin.write(code, 'utf8');
  proc.stdin.end();

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', d => { stdout += d; });
  proc.stderr.on('data', d => { stderr += d; });

  const timer = setTimeout(() => { proc.kill(); res.status(504).json({ error: 'Timeout' }); }, 10000);

  proc.on('close', () => {
    clearTimeout(timer);
    if (res.headersSent) return;
    const out = stdout.trim();
    if (out === 'valid') return res.json({ valid: true, info: 'Valid Python syntax' });
    if (out.startsWith('error:')) {
      const parts = out.split(':');
      return res.json({ valid: false, line: parseInt(parts[1]) || null, col: parseInt(parts[2]) || null, message: parts.slice(3).join(':').trim() || 'Syntax error' });
    }
    res.status(500).json({ error: 'Python not available on this server' });
  });

  proc.on('error', () => {
    clearTimeout(timer);
    if (!res.headersSent) res.status(500).json({ error: 'Python not installed on this server' });
  });
});

module.exports = router;
