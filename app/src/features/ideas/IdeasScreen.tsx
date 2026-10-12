import { useBackIdea, useIdeas, useSubmitIdea } from '@/core/api/queries';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button, QueryBoundary, StatusPill } from '@/shared/components/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Ideas() {
  const { t } = useTranslation();
  const ideasQ = useIdeas();
  const submit = useSubmitIdea();
  const back = useBackIdea();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    await submit.mutateAsync(text.trim());
    setText('');
    setSent(true);
    setTimeout(() => setSent(false), 1600);
  };

  return (
    <div>
      <ScreenHeader titleTa={t('profile.myIdeas')} titleEn="My ideas" />
      <div style={{ padding: '16px 16px 28px' }}>
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.hairline}`,
            borderRadius: radius.lg,
            padding: 14,
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="உங்கள் யோசனையைப் பகிருங்கள் · Share an idea"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: 'none',
              outline: 'none',
              resize: 'none',
              font: `400 14px/1.6 ${font.ta}`,
              color: c.ink,
              background: 'transparent',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <button
              aria-label="Record"
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: `1px solid ${c.hairline}`,
                background: c.page,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="mic" size={18} color={c.maroon} />
            </button>
            <Button
              variant={sent ? 'success' : 'primary'}
              icon={sent ? 'check' : undefined}
              style={{ height: 44 }}
              disabled={submit.isPending || !text.trim()}
              onClick={send}
            >
              {sent ? t('common.saved') : t('common.send')}
            </Button>
          </div>
        </div>

        <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '24px 0 12px' }}>
          சமூக யோசனைகள் · Community ideas
        </div>
        <QueryBoundary query={ideasQ}>
          {(ideas) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  style={{
                    background: c.card,
                    border: `1px solid ${c.hairline}`,
                    borderRadius: radius.lg,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ font: `600 13px/1 ${font.ui}`, color: c.ink0 }}>
                      {idea.authorName}
                    </span>
                    <StatusPill
                      label={
                        idea.status === 'adopted'
                          ? 'ஏற்கப்பட்டது'
                          : idea.status === 'reviewing'
                            ? 'பரிசீலனை'
                            : 'சமர்ப்பிக்கப்பட்டது'
                      }
                      tone={
                        idea.status === 'adopted'
                          ? 'success'
                          : idea.status === 'reviewing'
                            ? 'info'
                            : 'neutral'
                      }
                    />
                  </div>
                  <div style={{ font: `400 14px/1.6 ${font.ta}`, color: c.ink }}>{idea.bodyTa}</div>
                  <button
                    onClick={() => back.mutate(idea.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      marginTop: 12,
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: `1px solid ${idea.backedByMe ? c.maroon : c.hairline}`,
                      background: idea.backedByMe ? c.maroonTint : c.page,
                      color: idea.backedByMe ? c.maroon : c.ink2,
                      font: `600 13px/1 ${font.ui}`,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon
                      name="heart"
                      size={16}
                      color={idea.backedByMe ? c.maroon : c.ink2}
                      fill={idea.backedByMe ? c.maroon : 'none'}
                    />
                    {idea.backings}
                  </button>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
