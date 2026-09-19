/* ============================================================================
 * i18n —— 界面三语（中文 / English / Русский）
 * ----------------------------------------------------------------------------
 * d335 original —— D335-RTDLOGO 项目组成部分，© darst335
 * 设计：
 *   TXT : 以「中文原文」为键（含动态模板 {var} 占位符），运行时查表替换，
 *         覆盖 toast / confirm / 动态拼接文案 / 简单文本节点 / title / placeholder。
 *   HTML: 富文本块（含 <b> 等标签的长提示），模板中以 data-i18n="key" 标记。
 *   切换语言后派发 window 事件 'rtdlang'，ui.js 负责重渲染动态区域。
 * ========================================================================== */
(function () {
  const TXT = {
    /* ---- 头部 ---- */
    'RTD 开机 Logo 工作室': { en: 'RTD Boot Logo Studio', ru: 'RTD Boot Logo Studio' },
    '未打开固件': { en: 'No firmware loaded', ru: 'Прошивка не загружена' },
    '从电脑打开…': { en: 'Open from PC…', ru: 'Открыть с ПК…' },
    '打开固件 (.bin)': { en: 'Open firmware (.bin)', ru: 'Открыть прошивку (.bin)' },
    '退出程序': { en: 'Exit', ru: 'Выход' },
    '退出后台程序（关掉页面也会自动退出）': { en: 'Quit the background server (closing the page also exits)', ru: 'Закрыть фоновый сервер (закрытие страницы также завершает его)' },
    '作者：darst335（与 AI 结对开发）· 连点 3 次查看归属声明': { en: 'Author: darst335 (pair-programmed with AI) · click 3× for authorship notice', ru: 'Автор: darst335 (в паре с ИИ) · 3 клика — уведомление об авторстве' },
    /* ---- 卡片 1 ---- */
    '固件识别': { en: 'Firmware Detection', ru: 'Анализ прошивки' },
    '状态': { en: 'Status', ru: 'Статус' },
    '请先打开固件文件': { en: 'Open a firmware file first', ru: 'Сначала откройте файл прошивки' },
    '墨迹极性': { en: 'Ink polarity', ru: 'Полярность чернил' },
    'bit=1 是墨迹（常规）': { en: 'bit=1 = ink (normal)', ru: 'bit=1 = чернила (обычно)' },
    'bit=0 是墨迹（反相库）': { en: 'bit=0 = ink (inverted font)', ru: 'bit=0 = чернила (инверт. шрифт)' },
    /* ---- 卡片 2 ---- */
    '设计新 Logo': { en: 'Design New Logo', ru: 'Создание логотипа' },
    '画布': { en: 'Canvas', ru: 'Холст' },
    '调整大小': { en: 'Resize', ru: 'Изменить размер' },
    '文字生成': { en: 'Text', ru: 'Текст' },
    '图片替换': { en: 'Image', ru: 'Картинка' },
    '画笔修改': { en: 'Brush', ru: 'Кисть' },
    '输入 logo 文字，可多行': { en: 'Logo text, multiple lines allowed', ru: 'Текст логотипа, можно несколько строк' },
    '字体': { en: 'Font', ru: 'Шрифт' },
    '样式': { en: 'Style', ru: 'Стиль' },
    '加粗': { en: 'Bold', ru: 'Жирный' },
    '斜体': { en: 'Italic', ru: 'Курсив' },
    '高度': { en: 'Height', ru: 'Высота' },
    '模式': { en: 'Mode', ru: 'Режим' },
    '叠加模式（不清空已导入的图片/现有内容，文字直接叠上去）': { en: 'Overlay mode (keeps imported image / existing content; text is layered on top)', ru: 'Режим наложения (сохраняет картинку/содержимое; текст ложится сверху)' },
    '位置': { en: 'Position', ru: 'Позиция' },
    '水平位置': { en: 'Horizontal position', ru: 'Горизонтальная позиция' },
    '垂直位置': { en: 'Vertical position', ru: 'Вертикальная позиция' },
    '阈值': { en: 'Threshold', ru: 'Порог' },
    '生成文字 Logo': { en: 'Generate Text Logo', ru: 'Создать текстовый логотип' },
    '选择图片…': { en: 'Choose image…', ru: 'Выбрать картинку…' },
    '未选择': { en: 'None selected', ru: 'Не выбрано' },
    '适配': { en: 'Fit', ru: 'Вписать' },
    '居中适配（保持比例）': { en: 'Fit centered (keep ratio)', ru: 'По центру (с пропорциями)' },
    '拉伸铺满': { en: 'Stretch to fill', ru: 'Растянуть' },
    '选项': { en: 'Options', ru: 'Опции' },
    '反相': { en: 'Invert', ru: 'Инверсия' },
    '抖动（照片用）': { en: 'Dither (for photos)', ru: 'Дизеринг (для фото)' },
    '颜色': { en: 'Color', ru: 'Цвет' },
    '保留图片颜色': { en: 'Keep image colors', ru: 'Сохранять цвета картинки' },
    '按格自动匹配调色板': { en: 'Auto-match palette per cell', ru: 'Автоподбор палитры по ячейкам' },
    '生成图片 Logo': { en: 'Generate Image Logo', ru: 'Создать логотип из картинки' },
    '工具': { en: 'Tools', ru: 'Инструменты' },
    '✏ 画笔': { en: '✏ Brush', ru: '✏ Кисть' },
    '🧽 橡皮': { en: '🧽 Eraser', ru: '🧽 Ластик' },
    '笔宽': { en: 'Brush size', ru: 'Размер кисти' },
    '↶ 撤销': { en: '↶ Undo', ru: '↶ Отмена' },
    '↷ 重做': { en: '↷ Redo', ru: '↷ Повтор' },
    '撤销上一步 (Ctrl+Z)': { en: 'Undo last step (Ctrl+Z)', ru: 'Отменить шаг (Ctrl+Z)' },
    '重做 (Ctrl+Y)': { en: 'Redo (Ctrl+Y)', ru: 'Повторить (Ctrl+Y)' },
    '全图反相': { en: 'Invert all', ru: 'Инвертировать всё' },
    '清空': { en: 'Clear', ru: 'Очистить' },
    '恢复原 Logo': { en: 'Restore original', ru: 'Вернуть оригинал' },
    /* ---- 卡片 3 / 4 ---- */
    '写入体检': { en: 'Write Check', ru: 'Проверка записи' },
    '唯一字模': { en: 'Unique glyphs', ru: 'Уник. глифов' },
    '压缩后字库': { en: 'Compressed font', ru: 'Сжатый шрифт' },
    '可写预算': { en: 'Write budget', ru: 'Бюджет записи' },
    '写入方案': { en: 'Write plan', ru: 'План записи' },
    '写入颜色': { en: 'Write color', ru: 'Цвет записи' },
    '原地放不下时自动重定位字库到空闲区（同时改写加载指令）': { en: 'Auto-relocate the font block to free space when it does not fit in place (loader instructions rewritten too)', ru: 'Если не помещается на месте — автоматически перенести шрифт в свободную область (и переписать инструкции загрузки)' },
    '确认替换': { en: 'Apply & Replace', ru: 'Замена' },
    '替换只改 logo 数据（MAP 表 + 字库块），其余字节原样保留，文件总大小不变。刷机需用编程器 / ISP 工具把新 .bin 写回板子。': { en: 'Replacing only rewrites logo data (MAP table + font block); all other bytes stay untouched and file size is unchanged. Flash the new .bin back with a programmer / ISP tool.', ru: 'Замена меняет только данные логотипа (MAP-таблица + блок шрифта), остальные байты не трогаются, размер файла не меняется. Прошейте новый .bin программатором / ISP-инструментом.' },
    '确认替换并生成固件…': { en: 'Apply & Generate Firmware…', ru: 'Применить и создать прошивку…' },
    /* ---- 右侧 ---- */
    '原始 Logo': { en: 'Original Logo', ru: 'Оригинал' },
    '彩色': { en: 'Color', ru: 'Цвет' },
    '前景': { en: 'FG', ru: 'Текст' },
    '背景': { en: 'BG', ru: 'Фон' },
    '新 Logo': { en: 'New Logo', ru: 'Новый логотип' },
    '（可直接用画笔修改）': { en: '(editable with the brush)', ru: '(можно править кистью)' },
    '拖动 = 画 / 擦': { en: 'Drag = draw / erase', ru: 'Тяните = рисовать / стирать' },
    '✓ 固定文字 (Enter)': { en: '✓ Commit text (Enter)', ru: '✓ Зафиксировать (Enter)' },
    '固定文字：退出拖动/缩放编辑，之后可直接用画笔 (Enter)': { en: 'Commit text: exit drag/scale editing, brush works directly afterwards (Enter)', ru: 'Зафиксировать текст: выйти из режима перетаскивания/масштаба, далее можно рисовать кистью (Enter)' },
    '松手打开固件 / 图片': { en: 'Drop firmware / image to open', ru: 'Отпустите файл прошивки / картинки' },
    /* ---- 动态（ui.js） ---- */
    '本地服务模式：可直接替换原文件': { en: 'Local server mode: original file can be replaced directly', ru: 'Локальный сервер: можно заменить исходный файл напрямую' },
    '浏览器模式：替换后下载新文件': { en: 'Browser mode: a new file is downloaded after replacing', ru: 'Режим браузера: после замены скачивается новый файл' },
    'OSD 记录流型（MAZON / RTD270 族）': { en: 'OSD record-stream (MAZON / RTD270 family)', ru: 'OSD поток записей (семейство MAZON / RTD270)' },
    '品牌字库·串引用型（HY / ENVISION 族）': { en: 'Brand-font string-reference (HY / ENVISION family)', ru: 'Строковые ссылки на шрифт бренда (HY / ENVISION)' },
    '瓦片索引表拼图（HY 板厂大字库 · 实机标定路径）': { en: 'Tile-index-table mosaic (HY large font · calibrated on real hardware)', ru: 'Мозаика по таблице тайлов (большой шрифт HY · калибровано на железе)' },
    '静态 MAP 型（CDrawLogo）· ': { en: 'Static MAP (CDrawLogo) · ', ru: 'Статический MAP (CDrawLogo) · ' },
    '代码常量精确解析': { en: 'exact parse from code constants', ru: 'точный разбор констант кода' },
    '结构扫描': { en: 'structure scan', ru: 'сканирование структуры' },
    '识别机制': { en: 'Detection', ru: 'Механизм' },
    '数据流': { en: 'Data stream', ru: 'Поток данных' },
    '字符串表': { en: 'String table', ru: 'Таблица строк' },
    'MAP 表': { en: 'MAP table', ru: 'MAP-таблица' },
    '字库块': { en: 'Font block', ru: 'Блок шрифта' },
    '调色板': { en: 'Palette', ru: 'Палитра' },
    '画布尺寸': { en: 'Canvas size', ru: 'Размер холста' },
    '可写预算': { en: 'Write budget', ru: 'Бюджет записи' },
    '改动范围': { en: 'Scope of change', ru: 'Объём изменений' },
    '扫描 VLC 块': { en: 'VLC blocks scanned', ru: 'Найдено VLC-блоков' },
    '说明': { en: 'Note', ru: 'Примечание' },
    '未识别到可编辑的开机 logo': { en: 'No editable boot logo recognized', ru: 'Редактируемый загрузочный логотип не распознан' },
    '本工具支持「静态 MAP 型」（乐华等）、「品牌字库串引用型」（HY / ENVISION 等）与「OSD 记录流型」（MAZON / RTD270 等）logo。': { en: 'This tool supports "static MAP" (Lehua etc.), "brand-font string-reference" (HY / ENVISION etc.) and "OSD record-stream" (MAZON / RTD270 etc.) boot logos.', ru: 'Инструмент поддерживает логотипы: «статический MAP» (Lehua и др.), «строковые ссылки на шрифт бренда» (HY / ENVISION и др.) и «OSD поток записей» (MAZON / RTD270 и др.).' },
    '仍未识别的话，可能是位图型或其他私有机制，暂不支持自动编辑。': { en: 'If still not recognized, it may be a bitmap-based or other proprietary mechanism — automatic editing is not supported yet.', ru: 'Если не распозналось — возможно, это растровый или другой проприетарный формат, автоматическое редактирование пока не поддерживается.' },
    '已撤销': { en: 'Undone', ru: 'Отменено' },
    '已重做': { en: 'Redone', ru: 'Повторено' },
    '文字已固定：退出拖动 / 缩放编辑，可直接用画笔；双击文字可重新编辑': { en: 'Text committed: drag/scale editing exited, brush works directly; double-click text to edit again', ru: 'Текст зафиксирован: режим перетаскивания/масштаба выключен, кисть доступна; двойной клик — снова редактировать' },
    '请先打开固件': { en: 'Open a firmware first', ru: 'Сначала откройте прошивку' },
    '请先输入文字': { en: 'Enter some text first', ru: 'Сначала введите текст' },
    '文字已叠加（新增 {n} px），可直接拖动 / 缩放；按 Enter 固定文字': { en: 'Text overlaid (+{n} px). Drag / scale directly; press Enter to commit', ru: 'Текст наложен (+{n} px). Тяните / масштабируйте; Enter — зафиксировать' },
    '文字 Logo 已生成，可在画笔模式微调': { en: 'Text logo generated; fine-tune in brush mode', ru: 'Текстовый логотип создан; подправьте кистью' },
    '请先选择图片': { en: 'Choose an image first', ru: 'Сначала выберите картинку' },
    '图片 Logo 已生成': { en: 'Image logo generated', ru: 'Логотип из картинки создан' },
    '（彩色已按格匹配调色板）': { en: ' (colors matched to palette per cell)', ru: ' (цвета подобраны по палитре)' },
    '文字已与画面合并（画笔修改过），滑块/拖动不再实时调整；重新点「生成文字 Logo」叠加即可': { en: 'Text has been merged into the canvas (brush was used); sliders/drag no longer adjust it — click "Generate Text Logo" to overlay again', ru: 'Текст слит с холстом (использовалась кисть); ползунки/перетаскивание больше не действуют — нажмите «Создать текстовый логотип» для нового наложения' },
    '已重新进入文字编辑：拖动移动 / 右下角缩放，按 Enter 固定': { en: 'Text editing resumed: drag to move, bottom-right handle to scale, Enter to commit', ru: 'Редактирование текста возобновлено: тяните для перемещения, правый нижний угол — масштаб, Enter — зафиксировать' },
    '画笔颜色 = 写入颜色 {c}，换选颜色可分区域上色': { en: 'Brush color = write color {c}; pick another color to paint regions', ru: 'Цвет кисти = цвет записи {c}; выберите другой цвет для раскраски зон' },
    '写入失败：{r}': { en: 'Write failed: {r}', ru: 'Ошибка записи: {r}' },
    '通过（解码后与设计完全一致）': { en: 'PASS (decoded result matches the design exactly)', ru: 'Пройдено (декодировано, полностью совпадает с дизайном)' },
    '失败': { en: 'FAIL', ru: 'Не пройдено' },
    '已直接替换原文件：<b>{p}</b><br>备份：{b}': { en: 'Original file replaced directly: <b>{p}</b><br>Backup: {b}', ru: 'Исходный файл заменён напрямую: <b>{p}</b><br>Резервная копия: {b}' },
    '写回失败：{e}': { en: 'Write-back failed: {e}', ru: 'Ошибка записи: {e}' },
    '写回失败，已转为下载': { en: 'Write-back failed; fell back to download', ru: 'Ошибка записи, переключено на скачивание' },
    '已下载：{n}': { en: 'Downloaded: {n}', ru: 'Скачано: {n}' },
    '仅 OSD 记录流型支持调整画布（MAP / 串引用的表格结构尺寸固定）': { en: 'Only OSD record-stream logos support canvas resize (MAP / string-ref table sizes are fixed)', ru: 'Размер холста меняется только для OSD потоков (у MAP / строковых ссылок размер таблиц фиксирован)' },
    '画布太小（至少 4×2 格）': { en: 'Canvas too small (at least 4×2 cells)', ru: 'Холст слишком мал (минимум 4×2 ячеек)' },
    '超出上限：行 ≤ 24、列 ≤ 85': { en: 'Above limits: rows ≤ 24, cols ≤ 85', ru: 'Превышен лимит: строки ≤ 24, столбцы ≤ 85' },
    '超出 OSD 属性区上限（当前基础地址还剩 {n} 格）': { en: 'Exceeds the OSD attribute area limit ({n} cells left at current base address)', ru: 'Превышен лимит области атрибутов OSD (осталось {n} ячеек от базового адреса)' },
    '画布已调整为 {w}×{h} px（{r}×{c} 格）': { en: 'Canvas resized to {w}×{h} px ({r}×{c} cells)', ru: 'Холст изменён на {w}×{h} px ({r}×{c} ячеек)' },
    '请拖入 .bin 固件或图片': { en: 'Drop a .bin firmware or an image', ru: 'Перетащите .bin прошивку или картинку' },
    '读取失败：{e}': { en: 'Read failed: {e}', ru: 'Ошибка чтения: {e}' },
    '未识别到可编辑 logo，详见固件识别面板': { en: 'No editable logo recognized — see the Firmware Detection panel', ru: 'Редактируемый логотип не распознан — см. панель «Анализ прошивки»' },
    '已识别 logo：{r}×{c} 网格，{n} 字模': { en: 'Logo recognized: {r}×{c} grid, {n} glyphs', ru: 'Логотип распознан: сетка {r}×{c}, глифов: {n}' },
    /* 统计 / planHint */
    '流 {s} B + 字库 {f} B': { en: 'Stream {s} B + font {f} B', ru: 'Поток {s} Б + шрифт {f} Б' },
    '{u} &gt; 255 超限': { en: '{u} &gt; 255 over limit', ru: '{u} &gt; 255 — превышение' },
    '字模数超上限': { en: 'Glyph count over limit', ru: 'Число глифов выше лимита' },
    '唯一字模超过 255 个。请降低图片细节 / 关闭抖动，或提高阈值减少噪点。': { en: 'More than 255 unique glyphs. Reduce image detail / turn off dithering, or raise the threshold to cut noise.', ru: 'Более 255 уникальных глифов. Уменьшите детализацию / отключите дизеринг или поднимите порог.' },
    '{u} <span style="color:var(--tx2)">/ {a} 可用槽位</span>': { en: '{u} <span style="color:var(--tx2)">/ {a} slots available</span>', ru: '{u} <span style="color:var(--tx2)">/ {a} доступных слотов</span>' },
    '字库里找不到空白字模作为背景格': { en: 'No blank glyph in the font to use as background cell', ru: 'В шрифте нет пустого глифа для фоновой ячейки' },
    '唯一字模 {u} 超过可用槽位 {a}': { en: 'Unique glyphs {u} exceed available slots {a}', ru: 'Уникальных глифов {u} больше, чем слотов {a}' },
    '画布超出 OSD 属性区（上限 {a} 格）': { en: 'Canvas exceeds the OSD attribute area (limit {a} cells)', ru: 'Холст превышает область атрибутов OSD (лимит {a} ячеек)' },
    '请简化图案（减少细节 / 提高吸附阈值）。': { en: 'Simplify the artwork (less detail / higher snap threshold).', ru: 'Упростите рисунок (меньше деталей / выше порог привязки).' },
    '流 {s} B + 字库 {f} B ': { en: 'Stream {s} B + font {f} B ', ru: 'Поток {s} Б + шрифт {f} Б ' },
    '超预算': { en: 'over budget', ru: 'сверх бюджета' },
    '数据流超预算': { en: 'Data stream over budget', ru: 'Поток данных сверх бюджета' },
    '新数据流 {s} B 超过原流预算 {l} B。请简化图案（空白多、笔画成块会显著减小数据流）。': { en: 'New stream {s} B exceeds the original stream budget {l} B. Simplify the artwork (more blank space and blocky strokes shrink the stream a lot).', ru: 'Новый поток {s} Б превышает бюджет {l} Б. Упростите рисунок (пустоты и блочные штрихи заметно уменьшают поток).' },
    '字库块放不下': { en: 'Font block does not fit', ru: 'Блок шрифта не помещается' },
    '新字库 {f} B 超过原块预算 {l} B。请简化图案减少唯一字模。': { en: 'New font {f} B exceeds the original block budget {l} B. Simplify the artwork to cut unique glyphs.', ru: 'Новый шрифт {f} Б превышает бюджет блока {l} Б. Упростите рисунок, чтобы уменьшить число глифов.' },
    '<span style="color:var(--ok)">原地写入 @{a} + 字库 @{f}{m}</span>': { en: '<span style="color:var(--ok)">In-place write @{a} + font @{f}{m}</span>', ru: '<span style="color:var(--ok)">Запись на месте @{a} + шрифт @{f}{m}</span>' },
    ' · 收缩模式': { en: ' · shrink mode', ru: ' · режим сжатия' },
    '字库放不下完整内容，已收缩为新画面专用字库，并等长重映射尾部动画的字模引用（{n} 处）。': { en: 'The font cannot hold the full content; it has been shrunk to a dedicated font for the new picture, with equal-length remapping of glyph references in the tail animation ({n} patches).', ru: 'Шрифт не вмещает всё содержимое; он сжат под новую картинку, ссылки на глифы в хвостовой анимации перемаплены равной длиной ({n} правок).' },
    '数据流与字库均原地重写，新字模映射到原 logo 槽位，其余固件字节不动。': { en: 'Stream and font are both rewritten in place; new glyphs map to the original logo slots; all other firmware bytes untouched.', ru: 'Поток и шрифт перезаписываются на месте; новые глифы отображаются в слоты оригинального логотипа; остальные байты прошивки не тронуты.' },
    '{l} B（原地）': { en: '{l} B (in place)', ru: '{l} Б (на месте)' },
    '<span style="color:var(--ok)">原地写入 @{a}</span>': { en: '<span style="color:var(--ok)">In-place write @{a}</span>', ru: '<span style="color:var(--ok)">Запись на месте @{a}</span>' },
    '新字库比原来小 {d} B，无需移动任何代码。': { en: 'New font is {d} B smaller than the original; no code needs to move.', ru: 'Новый шрифт меньше оригинала на {d} Б; перемещать код не нужно.' },
    '新字库与原块同大小，无需移动任何代码。': { en: 'New font is the same size as the original block; no code needs to move.', ru: 'Новый шрифт того же размера, что и блок; перемещать код не нужно.' },
    '<span style="color:var(--warn)">重定位 @{a}</span>': { en: '<span style="color:var(--warn)">Relocated @{a}</span>', ru: '<span style="color:var(--warn)">Перенесено @{a}</span>' },
    '原地放不下，将把字库挪到同 bank 空闲区 {a}（{l} B 空闲），并改写字库加载指令的地址立即数。': { en: 'Does not fit in place: the font will move to a free run in the same bank at {a} ({l} B free), and the address immediates in the font-loading instructions will be rewritten.', ru: 'Не помещается на месте: шрифт будет перенесён в свободную область того же банка по адресу {a} ({l} Б свободно), адресные константы инструкций загрузки будут переписаны.' },
    '空间不足': { en: 'Not enough space', ru: 'Недостаточно места' },
    '原地与同 bank 空闲区都放不下 {n} B。请简化图案（减少细节/提高吸附）。': { en: 'Neither in-place nor any free run in the same bank can hold {n} B. Simplify the artwork (less detail / higher snap).', ru: 'Ни на месте, ни в свободных областях банка не помещается {n} Б. Упростите рисунок (меньше деталей / выше порог).' },
    '超出原地预算': { en: 'Exceeds in-place budget', ru: 'Сверх бюджета на месте' },
    '可勾选「自动重定位」，或简化图案。': { en: 'Tick "auto-relocate", or simplify the artwork.', ru: 'Включите «автоперенос» или упростите рисунок.' },
    '唯一字模超过 255 个（MAP 表每格只有 1 字节索引）。请在图片模式降低细节 / 关闭抖动，或提高阈值减少噪点。': { en: 'More than 255 unique glyphs (each MAP cell holds only a 1-byte index). Reduce detail / disable dithering in image mode, or raise the threshold.', ru: 'Более 255 уникальных глифов (в ячейке MAP только 1-байтовый индекс). Уменьшите детализацию / отключите дизеринг или поднимите порог.' },
    /* ---- 确认替换弹窗 ---- */
    '⚠ 确认替换开机 Logo': { en: '⚠ Confirm Boot Logo Replacement', ru: '⚠ Подтвердите замену загрузочного логотипа' },
    '固件：<b>{n}</b>（{s} 字节，改后大小不变）': { en: 'Firmware: <b>{n}</b> ({s} bytes, size unchanged after patch)', ru: 'Прошивка: <b>{n}</b> ({s} байт, размер не изменится)' },
    '画布：{w1}×{h1} → <b>{w2}×{h2}</b> px（若实机 OSD 窗口较小，放大部分可能被裁剪）': { en: 'Canvas: {w1}×{h1} → <b>{w2}×{h2}</b> px (if the on-screen OSD window is smaller, enlarged parts may be clipped)', ru: 'Холст: {w1}×{h1} → <b>{w2}×{h2}</b> px (если окно OSD мало, увеличенная часть может обрезаться)' },
    '颜色：逐格写入图片匹配色（背景格 = 调色板 idx{i}）': { en: 'Colors: per-cell matched image colors written (background cell = palette idx{i})', ru: 'Цвета: поячеечная запись подобранных цветов (фон = палитра idx{i})' },
    '① OSD 数据流：<b>{a}</b> → {b}（预算 {n} B）→ 重写为新画面的记录流': { en: '① OSD data stream: <b>{a}</b> → {b} (budget {n} B) → rewritten as the record stream of the new picture', ru: '① OSD поток данных: <b>{a}</b> → {b} (бюджет {n} Б) → перезаписывается под новую картинку' },
    '② 字库块：<b>{a}</b>（预算 {n} B）→ 新字模映射到原 logo 槽位后 VLC 重编码写入': { en: '② Font block: <b>{a}</b> (budget {n} B) → new glyphs mapped to the original logo slots, then VLC re-encoded and written', ru: '② Блок шрифта: <b>{a}</b> (бюджет {n} Б) → новые глифы отображаются в слоты логотипа и пишутся с VLC-перекодированием' },
    '① 字符串索引表：<b>{a}</b>（{n} 项）→ <b>原样保留</b>，新画面写入其引用的字模号': { en: '① String index table: <b>{a}</b> ({n} entries) → <b>kept unchanged</b>; the new picture writes the glyph indices it references', ru: '① Таблица строк: <b>{a}</b> ({n} записей) → <b>без изменений</b>; новая картинка пишет индексы глифов, на которые она ссылается' },
    '① MAP 表：<b>{a}</b> 起 {n} 字节 → 重写为新画面拼图': { en: '① MAP table: {n} bytes at <b>{a}</b> → rewritten as the new picture mosaic', ru: '① MAP-таблица: {n} байт с адреса <b>{a}</b> → перезаписывается под новую картинку' },
    '② 字库块：{opt}': { en: '② Font block: {opt}', ru: '② Блок шрифта: {opt}' },
    '<b>{a}</b> 起原地写入 {n} 字节（预算 {l} B）': { en: 'in-place write of {n} bytes at <b>{a}</b> (budget {l} B)', ru: 'запись {n} байт на месте с адреса <b>{a}</b> (бюджет {l} Б)' },
    '原地放不下 → 重定位到 <b>{a}</b> 写入 {n} 字节，并改写加载指令地址（{c} 处）': { en: 'does not fit in place → relocated to <b>{a}</b> with {n} bytes written, loader instruction addresses rewritten ({c} sites)', ru: 'не помещается → перенос на <b>{a}</b>, записано {n} байт, адреса инструкций загрузки переписаны ({c} мест)' },
    '③ 其余字节：原样保留{ext}': { en: '③ All other bytes: kept unchanged{ext}', ru: '③ Остальные байты: без изменений{ext}' },
    '（含数据流之后的动画记录组）': { en: ' (including the animation record group after the stream)', ru: ' (включая группы анимационных записей после потока)' },
    '④ 写入后回读校验：{m}': { en: '④ Read-back verification after write: {m}', ru: '④ Проверка чтением после записи: {m}' },
    '重新模拟数据流逐格比对 + 重新解码字库比对（自动执行）': { en: 're-simulate the stream cell by cell + re-decode the font and compare (automatic)', ru: 'повторная симуляция потока по ячейкам + перекодировка шрифта и сравнение (автоматически)' },
    '重新解码字库并比对（自动执行）': { en: 're-decode the font and compare (automatic)', ru: 'перекодировка шрифта и сравнение (автоматически)' },
    '⚠ 刷机有风险：请务必保留原固件备份。': { en: '⚠ Flashing is risky: always keep a backup of the original firmware. ', ru: '⚠ Прошивка — риск: обязательно сохраните резервную копию. ' },
    '点击「直接替换原文件」会先把原文件备份为 <b>.bak-时间戳</b> 再覆盖。': { en: 'Clicking "replace original file" first backs it up as <b>.bak-timestamp</b>, then overwrites.', ru: '«Заменить исходный файл» сначала сохранит копию <b>.bak-время</b>, затем перезапишет.' },
    '将下载新固件文件，原文件不会被改动；刷机前建议先刷「原文件备份」确认可回退。': { en: 'A new firmware file will be downloaded; the original file is not touched. Before flashing, test the backup first to confirm you can roll back.', ru: 'Новая прошивка будет скачана; исходный файл не меняется. Перед прошивкой проверьте резервную копию для отката.' },
    '取消': { en: 'Cancel', ru: 'Отмена' },
    '直接替换原文件': { en: 'Replace original file', ru: 'Заменить исходный файл' },
    '生成新固件': { en: 'Generate new firmware', ru: 'Создать новую прошивку' },
    '（下载）': { en: ' (download)', ru: ' (скачать)' },
    '✓ 新固件已生成': { en: '✓ New firmware generated', ru: '✓ Новая прошивка создана' },
    '回读校验：{r}': { en: 'Read-back check: {r}', ru: 'Проверка чтением: {r}' },
    '数据流：{a} · {s} 字节（预算 {l} B）': { en: 'Data stream: {a} · {s} bytes (budget {l} B)', ru: 'Поток данных: {a} · {s} байт (бюджет {l} Б)' },
    '字库块：{a} · {s} 字节（预算 {l} B）': { en: 'Font block: {a} · {s} bytes (budget {l} B)', ru: 'Блок шрифта: {a} · {s} байт (бюджет {l} Б)' },
    '字库写入：{a}{m} · {s} 字节': { en: 'Font written: {a}{m} · {s} bytes', ru: 'Шрифт записан: {a}{m} · {s} байт' },
    '（重定位，加载指令已改写）': { en: ' (relocated, loader instructions rewritten)', ru: ' (перенесено, инструкции загрузки переписаны)' },
    '（原地）': { en: ' (in place)', ru: ' (на месте)' },
    '下一步：用编程器 / ISP 工具把新 .bin 写回主板。若开机异常，刷回备份的原固件即可恢复。': { en: 'Next: flash the new .bin back with a programmer / ISP tool. If the boot screen misbehaves, flash the backed-up original firmware to recover.', ru: 'Далее: прошейте новый .bin программатором / ISP. Если заставка сбоит — прошейте сохранённый оригинал.' },
    '关闭': { en: 'Close', ru: 'Закрыть' },
    '下载新固件': { en: 'Download new firmware', ru: 'Скачать новую прошивку' },
    /* ---- 本地服务模式 ---- */
    '从电脑打开固件': { en: 'Open firmware from PC', ru: 'Открыть прошивку с ПК' },
    '输入文件夹路径，如 D:\\Users\\...\\Downloads': { en: 'Enter a folder path, e.g. D:\\Users\\...\\Downloads', ru: 'Введите путь к папке, напр. D:\\Users\\...\\Downloads' },
    '打开': { en: 'Open', ru: 'Открыть' },
    '上级：<a href="#" id="brUp">..</a>': { en: 'Parent: <a href="#" id="brUp">..</a>', ru: 'Вверх: <a href="#" id="brUp">..</a>' },
    '此目录没有 .bin 文件': { en: 'No .bin files in this folder', ru: 'В этой папке нет .bin файлов' },
    /* ---- 退出确认 ---- */
    '退出 RTD 开机 Logo 工作室？\n\n已写入的固件不受影响（备份文件也保留）。\n退出后本页面失效，关掉即可。': { en: 'Exit RTD Boot Logo Studio?\n\nAlready-written firmware is unaffected (backups are kept too).\nAfter exiting this page becomes inactive — just close it.', ru: 'Выйти из RTD Boot Logo Studio?\n\nУже записанные прошивки не затронуты (копии сохранены).\nПосле выхода страница станет неактивной — просто закройте её.' },
    '程序已退出': { en: 'Server exited', ru: 'Сервер остановлен' },
    '现在可以关闭这个页面了。': { en: 'You can close this page now.', ru: 'Теперь эту страницу можно закрыть.' },
    /* ---- 初始信息表 ---- */
    '请先打开固件文件（.bin）': { en: 'Open a firmware file (.bin) first', ru: 'Сначала откройте файл прошивки (.bin)' },
    '实测': { en: 'Verified', ru: 'Проверено' },
    'RTD2270CLW（= RTD2270C，与 RTD2270 固件不通用）· 板 RTD270CLW-R10.1，其他型号请自行测试 · 支持：静态 MAP 型 / 串引用型 / OSD 记录流型开机 logo': { en: 'RTD2270CLW (= RTD2270C; firmware incompatible with RTD2270) · board RTD270CLW-R10.1, other models untested · supports: static MAP / string-reference / OSD record-stream boot logos', ru: 'RTD2270CLW (= RTD2270C; прошивка несовместима с RTD2270) · плата RTD270CLW-R10.1, другие модели не проверены · поддержка: статический MAP / строковые ссылки / OSD поток записей' },
    /* ---- 动态碎片（拼接文案里的中文片段） ---- */
    ' · 16 色 LUT · logo 用色：': { en: ' · 16-color LUT · colors used: ', ru: ' · 16-цветная LUT · использованы цвета: ' },
    '（原 logo 主色）': { en: ' (original logo color)', ru: ' (исходный цвет логотипа)' },
    ' 格': { en: ' cells', ru: ' ячеек' },
    '网格 · ': { en: ' grid · ', ru: ' сетка · ' },
    ' · 彩色（按固件调色板）': { en: ' · color (firmware palette)', ru: ' · цвет (палитра прошивки)' },
    ' 个': { en: '', ru: '' },
    ' 项索引（显示时保持不变）': { en: ' entries (kept unchanged on display)', ru: ' записей (без изменений при показе)' },
    ' 字模 · 压缩 ': { en: ' glyphs · compressed ', ru: ' глифов · сжато ' },
    ' B (1bpp)': { en: ' B (1bpp)', ru: ' Б (1bpp)' },
    '数据流 ': { en: 'Stream ', ru: 'Поток ' },
    ' B + 字库 ': { en: ' B + font ', ru: ' Б + шрифт ' },
    ' B（均原地）': { en: ' B (both in place)', ru: ' Б (оба на месте)' },
    ' B（原地，超出自动重定位）': { en: ' B (in place; auto-relocates when over)', ru: ' Б (на месте; при превышении — автоперенос)' },
    '（按空白块推断）': { en: ' (inferred from blank blocks)', ru: ' (определено по пустым блокам)' },
    '数据流重写 + 字库块（新字模映射到原 logo 槽位），其余原样': { en: 'stream rewritten + font block (new glyphs mapped to original logo slots); everything else untouched', ru: 'перезапись потока + блок шрифта (новые глифы в слотах логотипа); остальное без изменений' },
    '仅字库块（字符串表原样保留），约 ': { en: 'font block only (string table kept unchanged), about ', ru: 'только блок шрифта (таблица строк без изменений), около ' },
    'MAP 表+字库（原位）': { en: 'MAP table + font (in place)', ru: 'MAP-таблица + шрифт (на месте)' },
    '可调（12 的倍数 × 18 的倍数）。上限：OSD 属性区 {c} 格、行 ≤ 24。放大超过原尺寸时，实际屏幕 OSD 窗口由固件设定，可能被裁剪；缩小始终安全。': { en: 'Adjustable (multiples of 12 × multiples of 18). Limits: OSD attribute area {c} cells, rows ≤ 24. When enlarging beyond the original size, the on-screen OSD window is set by the firmware and may clip; shrinking is always safe.', ru: 'Настраивается (кратности 12 × кратности 18). Лимиты: область атрибутов OSD {c} ячеек, строки ≤ 24. При увеличении сверх исходного окно OSD задаётся прошивкой и может обрезать; уменьшение всегда безопасно.' }
  };

  /* 富文本块（含标签），模板中 data-i18n="key" */
  const HTML = {
    i_heading: {
      zh: 'RTD <b>开机 Logo</b> 工作室',
      en: 'RTD <b>Boot Logo</b> Studio',
      ru: 'RTD <b>Boot Logo</b> Студия'
    },
    i_hint_pol: {
      zh: '极性决定 1bpp 字模哪一位是笔画。已按硬件约定自动判定，预览与实机不符时再切换。',
      en: 'Polarity decides which bit of a 1bpp glyph is the stroke. It is auto-detected per the hardware convention — switch only if the preview disagrees with the real screen.',
      ru: 'Полярность определяет, какой бит 1bpp-глифа является штрихом. Определяется автоматически по аппаратным соглашениям — переключайте, только если предпросмотр не совпадает с экраном.'
    },
    i_hint_txt: {
      zh: '叠加模式（PS 式编辑）：点「生成文字 Logo」后，<b>直接在画布上拖动文字</b>即可移动位置；拖<b>文字右下角的蓝色方块</b>可拉伸缩放大小；鼠标悬停在文字上<b>滚轮</b>也能缩放。调整满意后<b>按 Enter</b>（或点画布右上角「✓ 固定文字」）固定文字、退出编辑；之后可直接用画笔修改，<b>双击文字</b>可重新进入编辑。位置 / 高度滑块与拖动实时同步，误操作按 <b>Ctrl+Z</b> 撤销（画布右上角也有撤销 / 重做按钮）。按住 <b>Alt</b> 可在文字区域内使用画笔（仅编辑态需要）。',
      en: 'Overlay mode (PS-style editing): after clicking "Generate Text Logo", <b>drag the text on the canvas</b> to move it; drag the <b>blue square at its bottom-right</b> to stretch/scale; hover over the text and use the <b>wheel</b> to scale too. When satisfied, <b>press Enter</b> (or click "✓ Commit text" at the canvas top-right) to fix the text and exit editing; afterwards the brush works directly, and <b>double-clicking the text</b> re-enters editing. Position / height sliders stay in sync with dragging; press <b>Ctrl+Z</b> to undo mistakes (undo/redo buttons also sit at the canvas top-right). Hold <b>Alt</b> to paint over the text area (only needed while editing).',
      ru: 'Режим наложения (редактирование в стиле Photoshop): после «Создать текстовый логотип» <b>тяните текст прямо на холсте</b>, чтобы переместить; <b>синий квадрат в правом нижнем углу</b> — растянуть/масштабировать; <b>колесо мыши</b> над текстом тоже масштабирует. Когда всё устраивает, <b>нажмите Enter</b> (или «✓ Зафиксировать» в правом верхнем углу холста) — текст зафиксируется, редактирование завершится; далее можно рисовать кистью, <b>двойной клик по тексту</b> вернёт редактирование. Ползунки позиции/высоты синхронизированы с перетаскиванием; <b>Ctrl+Z</b> отменяет ошибку (кнопки отмены/повтора также вверху холста). С <b>Alt</b> кисть работает поверх текста (нужно только в режиме редактирования).'
    },
    i_hint_img: {
      zh: '图片导入后：在右侧「新 Logo」画布上<b>拖动</b>可移动图片位置，<b>滚轮</b>或滑块缩放，随时点「生成图片 Logo」重新生成。勾选「保留图片颜色」时，阈值变为<b>与背景色的色差</b>（自动取图片自身四角作背景色，拖动/缩放不会引起颜色跳变）。反相 / 抖动勾选后立即生效；彩色模式下抖动按色差做误差扩散。',
      en: 'After importing an image: <b>drag</b> on the "New Logo" canvas to move it, <b>wheel</b> or slider to zoom, click "Generate Image Logo" any time to regenerate. With "Keep image colors" ticked, the threshold becomes a <b>color difference from the background</b> (background auto-estimated from the image\'s own four corners, so dragging/zooming never causes color jumps). Invert / dither apply immediately; in color mode, dithering does error-diffusion in color-difference space.',
      ru: 'После загрузки картинки: <b>тащите</b> по холсту «Новый логотип», чтобы переместить, <b>колесо</b> или ползунок — масштаб, «Создать логотип из картинки» пересоздаёт в любой момент. С включённым «Сохранять цвета картинки» порог становится <b>разницей цвета с фоном</b> (фон берётся из четырёх углов самой картинки — перетаскивание/масштаб не вызывают скачков цвета). Инверсия/дизеринг применяются сразу; в цветном режиме дизеринг — диффузия ошибки в пространстве цветовой разницы.'
    },
    i_hint_paint: {
      zh: '直接在右侧「新 Logo」画布上按住拖动即可修改（画布始终可画，无需先点生成）。<b>调色板固件下，画笔 = 「写入颜色」选中的颜色</b>（首次上色会自动勾选「保留图片颜色」），换选颜色即可给导入的图案分区域上色。<b>撤销 / 重做全局可用（Ctrl+Z / Ctrl+Y）</b>：画笔、生成、文字拖动、图片拖动等操作均可回退。',
      en: 'Draw directly by dragging on the "New Logo" canvas (always paintable, no generate step needed). <b>With palette firmware, the brush = the selected "write color"</b> (first paint auto-ticks "Keep image colors"); switch colors to paint imported artwork region by region. <b>Undo / redo work globally (Ctrl+Z / Ctrl+Y)</b>: brushing, generating, text dragging, image dragging — everything can be reverted.',
      ru: 'Рисуйте прямо перетаскиванием на холсте «Новый логотип» (холст всегда доступен для рисования, генерация не нужна). <b>Для прошивок с палитрой кисть = выбранный «цвет записи»</b> (первая закраска сама включит «Сохранять цвета картинки»); меняйте цвет, чтобы красить imported рисунок по зонам. <b>Отмена/повтор работают глобально (Ctrl+Z / Ctrl+Y)</b>: кисть, генерация, перетаскивание текста и картинки — всё откатывается.'
    },
    i_logo_note: {
      zh: '（可直接用画笔修改）',
      en: '(editable with the brush)',
      ru: '(можно править кистью)'
    }
  };

  let lang = 'zh';
  try { lang = localStorage.getItem('rtdlang') || 'zh'; } catch (e) { }

  function t(s) {
    if (lang === 'zh' || s == null) return s;
    const e = TXT[s];
    return e ? (e[lang] != null ? e[lang] : s) : s;
  }
  function tf(s, vars) {
    let r = t(s);
    if (vars && r) for (const k in vars) r = r.split('{' + k + '}').join(vars[k]);
    return r;
  }
  /* 片段级翻译：把字符串里出现的所有中文键（长键优先）替换为目标语言。
   * 用于 hex + 中文拼接的固件信息行。 */
  const CN_KEYS = Object.keys(TXT).filter(k => /[^\x00-\xff]/.test(k)).sort((a, b) => b.length - a.length);
  function frag(s) {
    if (lang === 'zh' || s == null || !/[^\x00-\xff]/.test(s)) return s;
    let out = String(s);
    for (const k of CN_KEYS) {
      const e = TXT[k][lang];
      if (e == null) continue;
      if (out.indexOf(k) !== -1) out = out.split(k).join(e);
    }
    return out;
  }
  /* 原文缓存：文本节点 / 属性首见时记录中文原文，保证任意语言间可互切 */
  const ORIG_T = new WeakMap();   // text node -> original text
  const ORIG_A = new WeakMap();   // element -> {attr: original}
  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!ORIG_T.has(n)) ORIG_T.set(n, n.textContent);
      const orig = ORIG_T.get(n);
      const trim = orig.trim();
      if (!trim) continue;
      if (lang === 'zh') { if (n.textContent !== orig) hits.push([n, orig]); continue; }
      const e = TXT[trim];
      if (e && e[lang] != null) hits.push([n, orig.replace(trim, e[lang])]);
    }
    for (const [n, s] of hits) n.textContent = s;
    root.querySelectorAll('[title],[placeholder]').forEach(el => {
      if (!ORIG_A.has(el)) {
        const o = {};
        ['title', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v != null) o[a] = v; });
        ORIG_A.set(el, o);
      }
      const o = ORIG_A.get(el);
      ['title', 'placeholder'].forEach(a => {
        const orig = o[a];
        if (orig == null) return;
        if (lang === 'zh') { if (el.getAttribute(a) !== orig) el.setAttribute(a, orig); return; }
        const e = TXT[orig.trim()];
        if (e && e[lang] != null) el.setAttribute(a, e[lang]);
      });
    });
  }
  function apply(l) {
    lang = TXT && l === 'zh' ? 'zh' : l;
    try { localStorage.setItem('rtdlang', lang); } catch (e) { }
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const d = HTML[el.getAttribute('data-i18n')];
      if (d) el.innerHTML = d[lang] || d.zh;
    });
    walk(document.body);
    walk(document.head);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    const sel = document.getElementById('selLang');
    if (sel && sel.value !== lang) sel.value = lang;
    window.dispatchEvent(new CustomEvent('rtdlang', { detail: { lang } }));
  }

  window.__I18N = { t, tf, frag, apply, get lang() { return lang; }, TXT, HTML };
})();
