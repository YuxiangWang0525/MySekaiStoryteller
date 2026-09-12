import { describe, expect, it } from 'vitest'
import { reduceStory, reduceStoryBeforeSnippet, StoryStatePrefixCache } from '@/story'
import StoryDispatcher from '../StoryDispatcher'
import type { StoryRuntime } from '@/story'
import type { StoryData } from '@/story'

function createReducerTestStory(): StoryData {
  return {
    version: 1,
    snippets: [
      {
        id: 'background',
        type: 'ChangeBackgroundImage',
        delay: 0,
        data: { background: 'school' }
      },
      {
        id: 'appear',
        type: 'LayoutAppear',
        delay: 0,
        data: {
          model: 'shiho',
          position: { side: 'Left', offset: 12 },
          motion: 'idle',
          facial: 'smile',
          hologram: true
        }
      },
      {
        id: 'parameter',
        type: 'DoParam',
        delay: 0,
        data: {
          model: 'shiho',
          params: [
            {
              paramId: 'ParamAngleX',
              start: 0,
              end: 7,
              curve: 'Linear',
              duration: 1
            }
          ]
        }
      },
      {
        id: 'parallel',
        type: 'Parallel',
        delay: 0,
        snippets: [
          {
            id: 'move',
            type: 'Move',
            delay: 0,
            data: {
              model: 'shiho',
              from: { side: 'Left', offset: 12 },
              to: { side: 'Right', offset: 0 },
              moveSpeed: 'Normal'
            }
          },
          {
            id: 'effect',
            type: 'ApplyEffect',
            delay: 0,
            data: {
              effectId: 'grayscale',
              target: { type: 'Model', model: 'shiho' },
              effect: { type: 'Grayscale', intensity: 1 },
              duration: 0.3
            }
          }
        ]
      },
      {
        id: 'target',
        type: 'Motion',
        delay: 0,
        data: { model: 'shiho', motion: 'wave' }
      }
    ]
  } as StoryData
}

describe('reduceStoryBeforeSnippet', () => {
  it('should compute correct state before the target snippet', () => {
    const story: StoryData = createReducerTestStory()
    const beforeTarget = reduceStoryBeforeSnippet(story, 'target')

    expect(beforeTarget.backgroundKey).toBe('school')
    expect(beforeTarget.models.shiho.position).toEqual({ side: 'Right', offset: 0 })
    expect(beforeTarget.models.shiho.lastFrame).toEqual({
      motion: 'idle',
      facial: 'smile'
    })
    expect(beforeTarget.models.shiho.parameters.ParamAngleX).toBe(7)
    expect(beforeTarget.effects.grayscale.effect.type).toBe('Grayscale')
  })
})

describe('StoryStatePrefixCache', () => {
  it('should match reduceStoryBeforeSnippet for every snippet', () => {
    const story: StoryData = createReducerTestStory()
    const prefixCache = new StoryStatePrefixCache()
    prefixCache.update(story)

    const beforeTarget = reduceStoryBeforeSnippet(story, 'target')
    expect(prefixCache.before('target')).toEqual(beforeTarget)
  })
})

describe('reduceStory', () => {
  it('should compute the final state after all snippets', () => {
    const story: StoryData = createReducerTestStory()
    const finalState = reduceStory(story)

    expect(finalState.models.shiho.lastFrame).toEqual({
      motion: 'wave',
      facial: 'smile'
    })
    expect(finalState.models.shiho.parameters).toEqual({})
  })
})

describe('StoryDispatcher', () => {
  it('should run snippets from the target and invoke scene methods in order', async () => {
    const calls: unknown[][] = []

    const scene = {
      fastForwarding: false,
      setFastForwarding(enabled: boolean) {
        this.fastForwarding = enabled
      },
      async restoreState(state: { backgroundKey: string | null }) {
        calls.push(['restore', state.backgroundKey])
      },
      commitState() {},
      invalidateState() {},
      async setLayoutMode(mode: string) {
        calls.push(['layout', mode])
      },
      async hideDialogue() {
        calls.push(['hide-dialogue'])
      }
    }

    const clock = {
      delay: async () => undefined,
      waitForResume: async () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      interrupt: () => undefined,
      cancel: () => undefined
    }

    const jumpStory: StoryData = {
      version: 1,
      snippets: [
        {
          id: 'jump-background',
          type: 'ChangeBackgroundImage',
          delay: 0,
          data: { background: 'roof' }
        },
        {
          id: 'jump-target',
          type: 'ChangeLayoutMode',
          delay: 0,
          data: { mode: 'Three' }
        },
        { id: 'jump-after', type: 'HideTalk', delay: 0 }
      ]
    } as StoryData

    const dispatcher = new StoryDispatcher({
      scene,
      clock
    } as unknown as StoryRuntime)

    await dispatcher.runFrom(jumpStory, 'jump-target')

    expect(calls).toEqual([['restore', 'roof'], ['layout', 'Three'], ['hide-dialogue']])
  })
})
