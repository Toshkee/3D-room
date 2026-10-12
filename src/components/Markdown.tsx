import { useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from './icons'

// A bot's reply as formatted text: Claude answers in Markdown (code blocks,
// lists, tables, inline code). Built as React elements — raw HTML in a reply
// is never injected — and links open in a new tab.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
  table: ({ node: _node, ...props }) => (
    <div className="md__table">
      <table {...props} />
    </div>
  ),
}

function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="md__code">
      <button type="button" className="md__copy" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
        {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
      </button>
      <pre ref={ref} {...props} />
    </div>
  )
}
