import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import './CodeEditor.css'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent) => void
  placeholder?: string
  autoFocus?: boolean
}

export function CodeEditor({ value, onChange, onKeyDown, autoFocus }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        syntaxHighlighting(defaultHighlightStyle),
        xml(),
        oneDark,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (onKeyDown) {
              onKeyDown(event)
            }
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '14px',
            height: '100%',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
          },
          '.cm-gutters': {
            backgroundColor: '#1e1e2e',
            color: '#6c7086',
            border: 'none',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#313244',
          },
          '.cm-content': {
            caretColor: '#f5e0dc',
            padding: '8px 0',
          },
          '.cm-activeLine': {
            backgroundColor: '#313244',
          },
          '.cm-selectionBackground': {
            backgroundColor: '#45475a !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: '#45475a !important',
          },
          '.cm-cursor': {
            borderLeftColor: '#f5e0dc',
          },
        }),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    viewRef.current = view

    if (autoFocus) {
      view.focus()
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // Only create editor once

  // Update editor content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentValue = view.state.doc.toString()
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
    }
  }, [value])

  return <div ref={editorRef} className="code-editor" />
}
