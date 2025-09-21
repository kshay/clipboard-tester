import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

class ClipboardTester extends LitElement {
  constructor() {
    super();
    this.header = "What's On My Clipboard?";
  }

  static properties = {
    header: { type: String },
    items: { type: Array },
  }

  static styles = css`
    :host {
      color: #1a1a1a;
      font-size: calc(10px + 2vmin);
      max-width: 1500px;
      min-height: 100vh;
      text-align: center;
    }

    @media only screen and (max-width: 500px) {
      :host {
        font-size: calc(10px + 4vmin);
      }
    }

    .header {
      font-size: 1.5em;
      margin: .3em;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('got-results', (evt) => {
      this.items = evt.detail.items;
    });
  }

  render() {
    return html`
        <h1 class="header">${this.header}</h1>
        <paste-receiver></paste-receiver>
        <paste-results .items=${this.items}></paste-results>
    `;
  }
}

class PasteReceiver extends LitElement {
  constructor() {
    super();
    this.items = [];
  }

  static get properties() {
    return {
      items: {
        type: Array,
      },
    };
  }

  static styles = css`
    :host {
      display: flex;
      justify-content: center;
    }
    .paste-receiver-wrapper {
      border: 1px solid #444;
      background-color: #fff;
      margin: 0 10px;
      padding: 5px;
      width: 100%;
      max-width: 800px;
    }
    .paste-receiver {
      caret-color: transparent;
      color: #777;
      font-weight: 600;
      height: 150px;
      line-height: 140px;
    }
    .paste-receiver:empty:before {
      content: attr(placeholder);
      pointer-events: none;
      display: block;
    }
  `;

  handlePaste(e) {
    e.preventDefault();
    this.items = [];
    for (const item of e.clipboardData.items) {
      this.items.push({
        type: item.type,
        data: e.clipboardData.getData(item.type),
        file: item.getAsFile(),
      });
    }
    this.dispatchEvent(new CustomEvent('got-results', {
      bubbles: true,
      composed: true,
      detail: {
        items: this.items,
      },
    }));
    // Remove focus so virtual keyboard will go away on mobile.
    // TODO: only do this if we think we're on mobile
    this.shadowRoot.querySelector('.paste-receiver').blur();
  }

  handleKeydown(e) {
    if (!e.metaKey) {
      e.preventDefault();
    }
  }

  handleDragover(e) {
    e.preventDefault();
  }

  render() {
    return html`
      <div class="paste-receiver-wrapper">
        <div
          class="paste-receiver"
          contenteditable="true"
          autofocus="true"
          placeholder="Paste something here!"
          @paste=${this.handlePaste}
          @keydown=${this.handleKeydown}
          @dragover=${this.handleDragover}
        ></div>
      </div>
    `;
  }
}

class ItemRenderer {
  constructor(item, position) {
    this.item = item;
    this.position = position;
  }

  notifyToggle() {
      const evt = new CustomEvent('control-toggled', {
        composed: true,
      });
      this.dispatchEvent(evt);
  }

  wrapperClass() {
    return '';
  }

  render() {
    return html`${this.item.data}`;
  }

  renderWrapper() {
    return html`
      <div class="item-wrapper ${this.wrapperClass()}">
        ${this.renderHeading()}
        ${this.renderControls()}
        <div class="content">
          ${this.render()}
        </div>
      </div>
    `;
  }

  renderHeading() {
    return html`
      <div class="item-heading">
        ${this.position}. ${this.displayName()}
      </div>
    `;
  }

  renderControls() {
    return html``;
  }
}

class DefaultItemRenderer extends ItemRenderer {
  displayName() {
    return this.item.type;
  }
}

class RtfItemRenderer extends ItemRenderer {
  displayName() {
    return 'Rich Text Format';
  }
}

class VcardItemRenderer extends ItemRenderer {
  displayName() {
    return 'vCard';
  }

  wrapperClass() {
    return 'plain-text';
  }

  renderControls() {
    const downloadLink = document.createElement('a');
    downloadLink.innerText = 'Download .vcf';
    downloadLink.download = 'vcard-from-clipboard.vcf';
    downloadLink.href = URL.createObjectURL(this.item.file);
    return html`<div class="controls">
      ${downloadLink}
    </div>`;
  }

  render() {
    const div = document.createElement('div');
    this.item.file.text().then((text) => {
      div.innerText = text;
    })
    return div;
  }
}

class UriListItemRenderer extends ItemRenderer {
  displayName() {
    return 'URI List';
  }

  // render() {
    // TODO: something more interesting when there's >1 URI in the list?
    // can't seem to bring about that state of affairs to test
  //}
}

class TextItemRenderer extends ItemRenderer {
  constructor(item, position) {
    super(item, position);
    this.item.data = this.item.data.replaceAll('\r', '\n');
    this.preInput = document.createElement('input');
    this.preInput.type = 'checkbox';
    this.preInput.onclick = this.notifyToggle;
  }

  displayName() {
    return 'Plain Text';
  }

  wrapperClass() {
    return 'plain-text';
  }

  renderControls() {
    return html`<div class="controls">
      <label>${this.preInput} Preformatted</label>
    </div>`;
  }

  render() {
    return this.preInput.checked ? html`<pre>${this.item.data}</pre>` : html`${this.item.data}`;
  }

}

class HtmlItemRenderer extends ItemRenderer {
  constructor(item, position) {
    super(item, position);
    this.showCodeInput = document.createElement('input');
    this.showCodeInput.type = 'checkbox';
    this.showCodeInput.onclick = this.notifyToggle;
  }

  displayName() {
    return 'HTML';
  }

  wrapperClass() {
    return this.showCodeInput.checked ? 'plain-text' : '';
  }

  renderControls() {
    return html`<div class="controls">
      <label>${this.showCodeInput} Show code</label>
    </div>`;
  }

  render() {
    return this.showCodeInput.checked ? html`${this.item.data}` : unsafeHTML(this.item.data);
  }
}

class ImageItemRenderer extends ItemRenderer {
  displayName() {
    return `${this.item.type.replace('image/', '').toUpperCase()} image`;
  }

  render() {
    const reader = new FileReader();
    const img = document.createElement('img');
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.readAsDataURL(this.item.file);
    return img;
  }
}

const CLASS_MAP = {
  'image/jpeg': ImageItemRenderer,
  'image/png': ImageItemRenderer,
  'text/html': HtmlItemRenderer,
  'text/plain': TextItemRenderer,
  'text/rtf': RtfItemRenderer,
  'text/uri-list': UriListItemRenderer,
  'text/vcard': VcardItemRenderer,
};

class ClipboardItem extends LitElement {
  constructor() {
    super();
    this.addEventListener('control-toggled', () => {
      this.requestUpdate();
    });
  }

  static properties = {
    item: {
      type: Object,
      attribute: true,
    },
    position: {
      type: Number,
      attribute: true,
    },
  }

  static styles = css`
    :host {
      background-color: #fff;
      width: 350px;
      border: 1px solid #333;
    }
    .item-wrapper {
      padding: 5px;
    }
    .item-heading {
      font-size: .8em;
      font-weight: 600;
    }
    img {
      max-width: 100%;
    }
    pre {
      margin-block: 0;
    }
    .content {
      font-size: .7em;
      max-height: 500px;
      overflow: scroll;
      padding: 10px;
    }
    .plain-text .content {
      font-family: monospace;
      text-align: left;
    }
    .controls {
      font-size: .5em;
      padding: 5px 0;
    }
    @media screen and (min-width: 500px) {
      .content {
        font-size: .5em;
      }
    }
  `;

  render() {
    if (!this.item) {
      return html``;
    }
    let cls = CLASS_MAP[this.item.type] || DefaultItemRenderer;
    this.itemRenderer = new cls(this.item, this.position);
    return this.itemRenderer.renderWrapper();
  }
}

class PasteResults extends LitElement {
  static properties = {
    items: {
      type: Array,
      attribute: true,
    },
  }

  static styles = css`
    :host {
      align-content: center;
      width: 750px;
    }
    .results-heading {
      margin: 10px 0;
    }
    .items-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin: 10px;
      padding-bottom: 40px;
    }
    .no-results {
      margin: 10px;
    }
  `;

  render() {
    return this.items?.length ? html`
      <div class="results-heading">${this.items.length} item${this.items.length > 1 ? 's' : ''} on clipboard</div>
      <div class="items-wrapper">
        ${this.items.map((item, i) => html`<clipboard-item .item=${item} position=${i + 1}></clipboard-item>`)}
      </div>
    ` : html`
      ${this.items ? html`
      <div class="no-results">
        Nothing on clipboard
      </div>` : html``}
    `;
  }
}

class PageFooter extends LitElement {
  static properties = {
    faqShowing: {
      type: Boolean,
      default: false,
    }
  }

  constructor() {
    super();
    this.faqShowing = false;
  }

  static styles = css`
    :host {
      background-color: #eee;
      border-top: 1px solid #000;
      bottom: 0;
      left: 0;
      position: fixed;
      text-align: center;
      padding: 10px;
      width: 100%;
      z-index: 99;
    }
    .faq-hidden {
      display: none;
    }
    .faq-showing {
      background-color: #fff;
      border: 1px solid #000;
      left: 10vw;
      max-height: 80vh;
      overflow: scroll;
      padding: 0 20px;
      position: fixed;
      text-align: left;
      top: 20px;
      width: calc(80vw - 40px);
      z-index: 101;
    }
    .faq-showing .question {
      font-weight: 600;
    }
    .faq-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: transparent;
      z-index: 100;
    }
  `;

  handleFaqClick(e) {
    e.preventDefault();
    this.faqShowing = true;
    let bgEl = document.createElement('div');
    bgEl.classList.add('faq-bg');
    bgEl.addEventListener('click', () => {
      this.faqShowing = false;
      this.shadowRoot.removeChild(bgEl);
    });
    this.shadowRoot.appendChild(bgEl);
  }

  hideFaq(e) {
    this.faqShowing = false;
  }

  render() {
    const classes = {
      'faq-showing': this.faqShowing,
      'faq-hidden': !this.faqShowing,
    };
    return html`
      Created by <a href="https://bsky.app/profile/kshay.com">Kevin Shay</a> •
      <a href
        @click=${this.handleFaqClick}
      >FAQ</a> •
      <a href="https://github.com/kshay/clipboard-tester">Code</a>
      <div class=${classMap(classes)}
      >
        <p class="question">
          What is it?
        </p>
        <p>
          Just a simple tool to report what your system clipboard contains right now.
        </p>
        <p class="question">
          Why?
        </p>
        <p>
          Did you ever notice how when you copy something from a Google doc and paste it
          into another, it arrives with its formatting intact, but if you paste the
          same thing into a text field, only its text will appear? Or how copying an image
          from a web page and pasting it elsewhere will sometimes result in the image
          itself and sometimes just the URL of the original? That's because "the clipboard"
          can contain multiple parts, with the copied content represented in different
          formats. I wanted a way to easily see what these pieces were at a given time,
          so I built this.
        </p>
        <p class="question">
          Is this a trick? Seems like a great way to harvest my sensitive data.
        </p>
        <p>
          No. It does nothing with whatever you paste other than inspect it and
          output the results to the same static page. There's no server involved
          and the code makes no HTTP requests.
        </p>
        <p class="question">
          What does it use?
        </p>
        <p>
          Web components in <a href="https://lit.dev/">Lit</a>;
          <a href="https://open-wc.org/">Open Web Components</a> for initial scaffolding;
          <a href="https://modern-web.dev/docs/dev-server/overview/">Web Dev Server</a>
          and <a href="https://sslip.io/">sslip.io</a> for development;
          <a href="https://rollupjs.org/">Rollup</a> to build.
        </p>
        <p class="question">
          Will you fix/improve/add something?
        </p>
        <p>
          Sure. You can communicate via the <a href="https://github.com/kshay/clipboard-tester">GitHub repo</a>.
        </p>
      </div>
    `;
  }
}

customElements.define('clipboard-tester', ClipboardTester);
customElements.define('paste-receiver', PasteReceiver);
customElements.define('paste-results', PasteResults);
customElements.define('clipboard-item', ClipboardItem);
customElements.define('page-footer', PageFooter);
