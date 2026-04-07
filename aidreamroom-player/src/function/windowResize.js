const isMobile = () => {
  const userAgent = navigator.userAgent;
  // return false;
  return userAgent.match(/(iPhone|iPod|Android|ios|iPad|AppleWebKit.*Mobile.*)/i);
}
export const querySize = (n1) => {
  let w = document.documentElement.clientWidth; // 获取设备的宽度
  let n = isMobile() ? 20 :
    10 * (w / 1305) >= 18
      ? 18
      : 10 * (w / 1305) >= 11
        ? 10 * (w / 1305)
        : 11;
  return n * n1
}
const setRem = () => {
  const reScreenSize = (wid) => {
    // 当设备宽度小于1400px时，不在改变rem的值
    let w = document.documentElement.clientWidth; // 获取设备的宽度
    let n = isMobile() ? 20 + 'px' :
      10 * (w / 1305) >= 18
        ? 18 + 'px'
        : 10 * (w / 1305) >= 11
          ? 10 * (w / 1305) + 'px'
          : 11 + 'px';
    document.documentElement.style.fontSize = n;
    console.log('11111111111111', n)

  };
  reScreenSize();
  window.addEventListener('load', reScreenSize);
  window.addEventListener('resize', () => reScreenSize(document.documentElement.clientWidth));
};
export default setRem;