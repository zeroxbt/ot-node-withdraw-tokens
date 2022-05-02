import { readFileSync } from "fs";

const requireJson = (path) => {
  return JSON.parse(readFileSync(new URL(path, import.meta.url)));
};

const denormalizeHex = (number) => {
  if (number == null) {
    return null;
  }
  number = number.toLowerCase();
  if (number.startsWith("0x")) {
    return number.substring(2);
  }
  return number;
};

export {requireJson, denormalizeHex};