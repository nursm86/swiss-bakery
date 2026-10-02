// The printable A4 menu card. Lays the categories out on orange A4 pages,
// measuring as it goes: a category that doesn't fit continues on the next page
// under a "(cont.)" header, and a subcategory heading never sits alone at the
// bottom of a page. Used by /menu (bundled) and the admin's print preview
// (served unbundled as /js/menu-board.js), so it imports nothing:
// formatPriceLines and the GST setting are passed in. Text goes in through
// textContent only.

const PX_PER_MM = 96 / 25.4;
const MIN_ROW_SPACE_PX = 40; // room a heading needs below it for at least one row
const PAGE_GAP_MM = 8; // space above the first band on pages after the first
const FOOTER_CLEARANCE_MM = 12;
const SAFE_IMAGE_PATH = /^(\/|https:\/\/)[^"\\\s]+$/;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const continuedMark = () => {
  const mark = el("span", "cont", " (cont.)");
  mark.style.cssText = "font-size:0.6em;font-style:italic;opacity:.75";
  return mark;
};

const buildItem = (item, showPhoto, formatPrice) => {
  const row = el("div", showPhoto ? "item with-photo" : "item");
  if (showPhoto) {
    const thumb = el("div", "thumb");
    if (item.imagePath && SAFE_IMAGE_PATH.test(item.imagePath)) thumb.style.backgroundImage = `url("${item.imagePath}")`;
    row.appendChild(thumb);
  }
  row.appendChild(el("div", "name", item.name));
  const lines = formatPrice(item);
  const price = el("div", lines.length === 0 ? "price muted" : "price");
  for (const line of lines.length > 0 ? lines : ["ask staff"]) price.appendChild(el("span", null, line));
  row.appendChild(price);
  return row;
};

const buildCategoryHead = (title, subtitle, isContinued) => {
  const block = el("div", "cat-headblock");
  const head = el("div", "cat-head");
  const heading = el("h2", null, title);
  if (isContinued) heading.appendChild(continuedMark());
  head.append(el("div", "rule"), heading, el("div", "rule"));
  block.appendChild(head);
  if (subtitle && !isContinued) block.appendChild(el("p", "cat-sub", subtitle));
  return block;
};

const buildSubcategoryHead = (label, isContinued) => {
  const head = el("div", "sub-head");
  const name = el("span", "sub-label", label);
  if (isContinued) name.appendChild(continuedMark());
  head.append(name, el("span", "sub-rule"));
  return head;
};

const buildHeader = (doc) => {
  const header = el("div", "header");
  const logo = el("div", "logo");
  const img = document.createElement("img");
  img.src = "/swiss_logo.png";
  img.alt = "Swiss Bakery";
  img.addEventListener("error", () => (img.style.display = "none"));
  logo.appendChild(img);
  header.append(logo, el("p", "tagline", doc.tagline ?? ""), el("p", "strapline", doc.strapline ?? ""));
  const wrap = el("div");
  wrap.append(header, el("div", "top-divider"));
  return wrap;
};

const buildFooter = (doc) => {
  const footer = el("div", "footer");
  footer.append(el("p", "note", doc.footer ?? ""), el("div", "loc", doc.location ?? ""));
  return footer;
};

const newPage = () => {
  const wrap = el("div", "page-fit");
  const page = el("article", "page");
  const body = el("div", "page-body");
  page.append(el("div", "frame"), body);
  wrap.appendChild(page);
  return { wrap, page, body };
};

/** A category's blocks: { label, items } per subcategory group (label null = no heading). */
const groupsOf = (category) =>
  (category.groups ?? [{ label: null, items: category.items ?? [] }]).filter((group) => group.items?.length > 0);

/**
 * Renders the menu into `stage` as A4 pages.
 * @param {HTMLElement} stage
 * @param {{ doc: object, categories: { title: string, subtitle?: string, columns?: number, showPhotos?: boolean,
 *   groups?: { label: string | null, items: object[] }[], items?: object[] }[] }} payload
 * @param {{ formatPriceLines: Function, gst: object }} pricing
 */
export const paginateMenu = (stage, { doc, categories }, { formatPriceLines, gst }) => {
  const formatPrice = (item) => formatPriceLines(item, gst);
  stage.replaceChildren();

  // Measure an empty page: the usable height, minus the band the footer needs.
  const probe = newPage();
  probe.wrap.style.visibility = "hidden";
  stage.appendChild(probe.wrap);
  const pageStyle = getComputedStyle(probe.page);
  const contentHeight = probe.page.clientHeight - parseFloat(pageStyle.paddingTop) - parseFloat(pageStyle.paddingBottom);
  const footerProbe = buildFooter(doc);
  probe.body.appendChild(footerProbe);
  const limit = contentHeight - (footerProbe.getBoundingClientRect().height + FOOTER_CLEARANCE_MM * PX_PER_MM + 6);
  probe.wrap.remove();

  const pages = [];
  let body = null;
  let hasRowsOnPage = false;

  // Height used on the current page, margins included.
  const usedHeight = () => {
    const last = body.lastElementChild;
    if (!last) return 0;
    const marginBottom = parseFloat(getComputedStyle(last).marginBottom) || 0;
    return last.getBoundingClientRect().bottom + marginBottom - body.getBoundingClientRect().top;
  };

  const startPage = () => {
    const page = newPage();
    stage.appendChild(page.wrap);
    pages.push(page);
    body = page.body;
    hasRowsOnPage = false;
    if (pages.length === 1) {
      body.appendChild(buildHeader(doc));
    } else {
      const spacer = el("div");
      spacer.style.height = `${PAGE_GAP_MM}mm`;
      body.appendChild(spacer);
    }
  };

  startPage();
  for (const category of categories) {
    const showPhoto = !!category.showPhotos || !!doc.showPhotos;
    const columns = category.columns ?? 2;
    let isCategoryHeadOnPage = false;
    let hasCategoryRows = false;

    for (const group of groupsOf(category)) {
      let index = 0;
      let isGroupHeadOnPage = false;
      let hasGroupRows = false;
      const headsNeeded = () => [
        ...(isCategoryHeadOnPage ? [] : [buildCategoryHead(category.title, category.subtitle, hasCategoryRows)]),
        ...(group.label && !isGroupHeadOnPage ? [buildSubcategoryHead(group.label, hasGroupRows)] : []),
      ];

      while (index < group.items.length) {
        let heads = headsNeeded();
        body.append(...heads);
        // Headings that leave no room for a row move to a new page with their first row.
        if (heads.length > 0 && hasRowsOnPage && limit - usedHeight() < MIN_ROW_SPACE_PX) {
          for (const head of heads) head.remove();
          startPage();
          isCategoryHeadOnPage = false;
          isGroupHeadOnPage = false;
          heads = headsNeeded();
          body.append(...heads);
        }
        isCategoryHeadOnPage = true;
        isGroupHeadOnPage = true;

        // Add a row at a time; a row that overflows goes back and continues on the next page.
        const grid = el("div", `items cols-${columns}`);
        body.appendChild(grid);
        let rowsInGrid = 0;
        let didOverflow = false;
        while (index < group.items.length) {
          const row = group.items.slice(index, index + columns).map((item) => buildItem(item, showPhoto, formatPrice));
          grid.append(...row);
          if (rowsInGrid > 0 && usedHeight() > limit) {
            for (const node of row) node.remove();
            didOverflow = true;
            break;
          }
          index += row.length;
          rowsInGrid++;
        }
        hasRowsOnPage = true;
        hasCategoryRows = true;
        hasGroupRows = true;
        if (didOverflow) {
          startPage();
          isCategoryHeadOnPage = false;
          isGroupHeadOnPage = false;
        }
      }
    }
  }

  // Footer on the last page, or on a page of its own if it would touch the content.
  const footer = buildFooter(doc);
  const lastBody = pages[pages.length - 1].body;
  const lastContent = lastBody.lastElementChild;
  lastBody.appendChild(footer);
  if (lastContent && footer.getBoundingClientRect().top < lastContent.getBoundingClientRect().bottom + 6) {
    footer.remove();
    const extra = newPage();
    stage.appendChild(extra.wrap);
    extra.body.appendChild(footer);
  }
};

/** Scales each A4 page down to fit the stage width (phones see the same pages, smaller). Run after paginateMenu. */
export const fitPagesToWidth = (stage) => {
  const stageStyle = getComputedStyle(stage);
  const available = stage.clientWidth - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
  for (const wrap of stage.querySelectorAll(".page-fit")) {
    const page = wrap.querySelector(".page");
    if (!page) continue;
    page.style.transform = "none";
    const width = page.offsetWidth || 210 * PX_PER_MM;
    const height = page.offsetHeight || 297 * PX_PER_MM;
    const scale = Math.min(1, available / width);
    page.style.transformOrigin = "top left";
    page.style.transform = `scale(${scale})`;
    wrap.style.width = `${width * scale}px`;
    wrap.style.height = `${height * scale}px`;
  }
};
