// Clean, consolidated pretty-printer shared by CLI and runner.
function prettyPrintResponse(res, opts = {}) {
  const raw = !!(opts && opts.raw);
  if (!res) return;
  if (raw) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  const SKIP_KEYS = new Set([
    "characterConnection",
    "planetConnection",
    "starshipConnection",
    "filmConnection",
    "connection",
    "edges",
    "node",
    "__typename",
  ]);

  const prettyPrintObject = (obj, indent = "") => {
    if (obj === null || obj === undefined) {
      console.log(indent + "null");
      return;
    }
    if (typeof obj !== "object") {
      console.log(indent + String(obj));
      return;
    }

    const keys = Object.keys(obj).filter((k) => !SKIP_KEYS.has(k));
    for (const k of keys) {
      const v = obj[k];
      const label = k[0].toUpperCase() + k.slice(1);
      if (v === null || v === undefined) {
        console.log(`${indent}${label}: ${v}`);
      } else if (Array.isArray(v)) {
        console.log(`${indent}${label}:`);
        if (v.length === 0) {
          console.log(`${indent}  (empty)`);
        } else {
          for (const item of v) {
            if (item === null || item === undefined) {
              console.log(`${indent}  - ${item}`);
              continue;
            }
            if (typeof item === "object") {
              const keysInner = Object.keys(item);
              let summary = null;
              let summaryKey = null;
              if (item.name) {
                summary = String(item.name);
                summaryKey = "name";
              } else if (item.title) {
                summary = String(item.title);
                summaryKey = "title";
              } else {
                for (const kk of keysInner) {
                  const vv = item[kk];
                  if (
                    vv === null ||
                    Array.isArray(vv) ||
                    typeof vv === "object"
                  )
                    continue;
                  summary = `${kk}: ${String(vv)}`;
                  summaryKey = kk;
                  break;
                }
              }
              if (!summary) {
                if (item.id) {
                  summary = String(item.id);
                  summaryKey = "id";
                } else {
                  summary = JSON.stringify(item).slice(0, 80);
                }
              }
              console.log(`${indent}  - ${summary}`);
              for (const kk of keysInner) {
                if (kk === summaryKey) continue;
                const vv = item[kk];
                const kkLabel = kk[0].toUpperCase() + kk.slice(1);
                if (vv === null || vv === undefined) {
                  console.log(`${indent}    ${kkLabel}: ${vv}`);
                } else if (Array.isArray(vv)) {
                  console.log(`${indent}    ${kkLabel}:`);
                  if (vv.length === 0) {
                    console.log(`${indent}      (empty)`);
                  } else {
                    for (const sub of vv) {
                      if (sub === null || sub === undefined) {
                        console.log(`${indent}      - ${sub}`);
                      } else if (typeof sub === "object") {
                        const subSummary =
                          sub.name ||
                          sub.title ||
                          sub.id ||
                          JSON.stringify(sub).slice(0, 60);
                        console.log(`${indent}      - ${subSummary}`);
                      } else {
                        console.log(`${indent}      - ${String(sub)}`);
                      }
                    }
                  }
                } else if (typeof vv === "object") {
                  console.log(`${indent}    ${kkLabel}:`);
                  prettyPrintObject(vv, indent + "      ");
                } else {
                  console.log(`${indent}    ${kkLabel}: ${String(vv)}`);
                }
              }
            } else {
              console.log(`${indent}  - ${String(item)}`);
            }
          }
        }
      } else if (typeof v === "object") {
        console.log(`${indent}${label}:`);
        prettyPrintObject(v, indent + "  ");
      } else {
        console.log(`${indent}${label}: ${String(v)}`);
      }
    }
  };

  const findArrays = (obj, path = []) => {
    if (Array.isArray(obj)) return [{ path, arr: obj }];
    if (obj && typeof obj === "object") {
      return Object.keys(obj).flatMap((k) =>
        findArrays(obj[k], path.concat(k))
      );
    }
    return [];
  };

  if (res && res.data) {
    const arrays = findArrays(res.data);
    if (arrays.length === 1) {
      const arr = arrays[0].arr;
      const path = arrays[0].path || [];
      const singleKey = (() => {
        if (!arr.length) return null;
        let k = null;
        for (const it of arr) {
          if (!it || typeof it !== "object") return null;
          const keys = Object.keys(it);
          if (keys.length !== 1) return null;
          if (k === null) k = keys[0];
          else if (k !== keys[0]) return null;
        }
        return k;
      })();

      const determineGroupLabel = (pathArr, key) => {
        const p = (pathArr || []).join(".").toLowerCase();
        if (/char|people|person/.test(p)) return "Characters:";
        if (/film/.test(p)) return "Films:";
        if (/planet/.test(p)) return "Planets:";
        if (/species/.test(p)) return "Species:";
        if (key === "name") return "Names:";
        return key ? key[0].toUpperCase() + key.slice(1) + ":" : "Items:";
      };

      if (singleKey) {
        console.log(determineGroupLabel(path, singleKey));
        for (const item of arr) {
          const val = item && item[singleKey];
          if (val === null || val === undefined) continue;
          console.log(`  - ${String(val)}`);
        }
        console.log("");
        return;
      }
      for (const item of arr) {
        if (item === null || item === undefined) continue;
        if (typeof item === "object") {
          prettyPrintObject(item, "");
        } else {
          console.log(String(item));
        }
        console.log("");
      }
      return;
    }
    if (arrays.length > 1) {
      for (const { path, arr } of arrays) {
        console.log(`# ${path.join(".")}`);
        for (const item of arr) {
          if (item === null || item === undefined) continue;
          if (typeof item === "object") {
            prettyPrintObject(item, "");
          } else {
            console.log(String(item));
          }
          console.log("");
        }
        console.log("");
      }
      return;
    }
  }

  if (res && res.data) {
    const topKeys = Object.keys(res.data || {});
    if (topKeys.length === 1) {
      const k = topKeys[0];
      const v = res.data[k];
      const heading = k[0].toUpperCase() + k.slice(1) + ":";
      console.log(heading);
      if (Array.isArray(v)) {
        const singleKey = (() => {
          if (!v.length) return null;
          let kk = null;
          for (const it of v) {
            if (!it || typeof it !== "object") return null;
            const keys = Object.keys(it);
            if (keys.length !== 1) return null;
            if (kk === null) kk = keys[0];
            else if (kk !== keys[0]) return null;
          }
          return kk;
        })();
        if (singleKey) {
          for (const item of v) {
            const val = item && item[singleKey];
            if (val === null || val === undefined) continue;
            console.log(`  - ${String(val)}`);
          }
          console.log("");
          return;
        }
        for (const it of v) {
          if (typeof it === "object") prettyPrintObject(it, "  ");
          else console.log("  " + String(it));
        }
        console.log("");
        return;
      }
      if (typeof v === "object") {
        prettyPrintObject(v, "  ");
        console.log("");
        return;
      }
      console.log(String(v));
      console.log("");
      return;
    }
    prettyPrintObject(res.data, "");
    return;
  }

  console.log(JSON.stringify(res, null, 2));
}

module.exports = { prettyPrintResponse };
