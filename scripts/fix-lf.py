import pathlib
p = pathlib.Path(r"C:\Users\PC-Master-Race\Documents\GOYAHACK\scripts\demo.sh")
raw = p.read_bytes()
# Strip CR; keep LF only. Standardize to LF.
text = raw.decode('utf-8')
text = text.replace('\r\n', '\n').replace('\r', '\n')
# also strip trailing blank lines
p.write_bytes(text.encode('utf-8'))
print(f"LF normalized to {len(text.splitlines())} lines.")
