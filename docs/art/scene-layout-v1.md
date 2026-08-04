# Scene Layout V1

本文档与 [scene-layout.json](file:///c:/Users/1/Documents/GitHub/today-dont-push/apps/web/src/features/space/scene-layout.json) 及 [scene-layout.ts](file:///c:/Users/1/Documents/GitHub/today-dont-push/apps/web/src/features/space/scene-layout.ts) 保持同步，当前舞台基准为 `1440 x 900`。

## 1. 1440x900 舞台坐标表

| 槽位 | x | y | width | height | zIndex |
| --- | ---: | ---: | ---: | ---: | ---: |
| windowViewport | 445 | 10 | 940 | 520 | 1 |
| roomForeground | 0 | 0 | 1440 | 900 | 4 |
| planBoard | 89 | 108 | 317 | 247 | 6 |
| deskLamp | 734 | 496 | 219 | 323 | 7 |
| radio | 238 | 631 | 259 | 179 | 7 |
| focusClock | 550 | 667 | 194 | 121 | 7 |
| tarotEntry | 1146 | 221 | 144 | 144 | 7 |
| magazine | 441 | 667 | 245 | 172 | 6 |
| reviewPrinter | 1128 | 539 | 219 | 271 | 7 |
| plant | 936 | 587 | 187 | 227 | 7 |

## 2. 每个槽位 x/y/width/height

- `windowViewport`: `445 / 10 / 940 / 520`
- `roomForeground`: `0 / 0 / 1440 / 900`
- `planBoard`: `89 / 108 / 317 / 247`
- `deskLamp`: `734 / 496 / 219 / 323`
- `radio`: `238 / 631 / 259 / 179`
- `focusClock`: `550 / 667 / 194 / 121`
- `tarotEntry`: `1146 / 221 / 144 / 144`
- `magazine`: `441 / 667 / 245 / 172`
- `reviewPrinter`: `1128 / 539 / 219 / 271`
- `plant`: `936 / 587 / 187 / 227`

## 3. 1920x1200 源图换算规则

当源图基准为 `1920 x 1200`，设计坐标换算规则为：

- `sourceX = designX × 4 / 3`
- `sourceY = designY × 4 / 3`
- `sourceWidth = designWidth × 4 / 3`
- `sourceHeight = designHeight × 4 / 3`

## 4. room foreground 透明窗洞源图坐标

`windowViewport = 445 / 10 / 940 / 520`

换算到 `1920 x 1200` 源图后：

- `sourceX = 593.33`
- `sourceY = 13.33`
- `sourceWidth = 1253.33`
- `sourceHeight = 693.33`

如美术工具需要整数像素，建议向外扩一圈处理为：

- `593 / 13 / 1254 / 694`

## 5. 窗洞必须完全透明

- `roomForeground` 的窗洞区域必须是完全透明，不能留半透明底色、磨砂蒙版或烘焙背景。
- 天空、城市和天气层会从该透明窗洞透出。

## 6. 室内前景不得包含独立 props

- `roomForeground` 只承载室内静态结构和桌面前景。
- 不得把 `planBoard`、`deskLamp`、`radio`、`focusClock`、`tarotEntry`、`magazine`、`reviewPrinter`、`plant` 画进室内前景源图。

## 7. 独立物件必须透明 PNG，阴影不得裁切

- 所有独立物件必须输出透明 PNG。
- 物件自带阴影、发光或外扩效果时，画布必须预留足够安全边距，避免裁切。

## 8. 图片中不得画死动态文字

- 不得在图片里写死日期、任务、时间、曲名、天气数值、状态文案或任何未来需要程序驱动的动态文字。
- 未来动态信息必须留给前端层叠加，而不是烘焙进资源。
