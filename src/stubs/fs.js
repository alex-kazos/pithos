// fs stub for Cloudflare Workers
export default {
  readFileSync: () => '',
  promises: {
    readFile: () => Promise.resolve(''),
  }
};
export const readFileSync = () => '';
export const promises = {
  readFile: () => Promise.resolve(''),
};
