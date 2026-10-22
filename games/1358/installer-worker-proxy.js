const source = new URL(self.location.href).searchParams.get('source');
if (!source) {
  throw new Error('The GTA2 installer worker source URL is missing.');
}

await import(source);
