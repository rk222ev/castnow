module.exports = coll => {
  const out = [];
  for (let i = coll.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [coll[j], coll[i]];
  }
  return out;
}
