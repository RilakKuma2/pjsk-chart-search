export function clampChartViewport({ x, y, width, height, contentWidth, contentHeight }) {
  const totalWidth=Math.max(1,Number(contentWidth)||1),totalHeight=Math.max(1,Number(contentHeight)||1)
  const left=Math.max(0,Math.min(Number(x)||0,totalWidth-1))
  const top=Math.max(0,Math.min(Number(y)||0,totalHeight-1))
  return {
    x:left,
    y:top,
    width:Math.max(1,Math.min(Number(width)||1,totalWidth-left)),
    height:Math.max(1,Math.min(Number(height)||1,totalHeight-top)),
  }
}
