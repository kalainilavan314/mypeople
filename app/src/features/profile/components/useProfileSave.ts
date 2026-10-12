import { authApi, type ProfileUpdate, type ServerMember } from '@/core/api/authApi';
import { keys } from '@/core/api/queries';
import { compressImage } from '@/core/lib/image';
import { meKey } from '@/shared/hooks/useMe';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function useProfileSave(me: ServerMember) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const selection = useRef(0);

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    const current = ++selection.current;
    setError(null);
    setAvatarPreview(null);
    setProcessing(true);
    try {
      const preview = await compressImage(file, 512, 0.85);
      if (current === selection.current) setAvatarPreview(preview);
    } catch {
      if (current === selection.current) setError(t('editProfile.badImage'));
    } finally {
      if (current === selection.current) setProcessing(false);
    }
  };

  const save = async (values: ProfileUpdate) => {
    if (saving || processing || saved) return;
    setError(null);
    const name = values.name?.trim() ?? '';
    if (name.length < 2 || name.length > 150) return setError(t('editProfile.badName'));
    if (values.dob && (values.dob < '1900-01-01' || values.dob > new Date().toISOString().slice(0, 10))) {
      return setError(t('editProfile.badDob'));
    }
    const update: ProfileUpdate = {};
    if (name !== me.fullName) update.name = name;
    const originalDob = me.dob ? String(me.dob).slice(0, 10) : null;
    if (values.dob !== originalDob) update.dob = values.dob;
    if (values.gender !== (me.gender || null)) update.gender = values.gender;
    if (values.gsCode !== (me.gsCode || null)) update.gsCode = values.gsCode;
    if (values.phone !== (me.phone || null)) update.phone = values.phone;
    setSaving(true);
    let detailsSaved = false;
    let uploading = false;
    try {
      if (Object.keys(update).length) {
        const member = await authApi.updateProfile(update);
        qc.setQueryData(meKey, member);
        detailsSaved = true;
      }
      if (avatarPreview) {
        uploading = true;
        const member = await authApi.uploadAvatar(avatarPreview);
        qc.setQueryData(meKey, member);
        setAvatarPreview(null);
      }
      await qc.invalidateQueries({ queryKey: keys.member });
      await qc.invalidateQueries({ queryKey: meKey });
      setSaved(true);
      setTimeout(() => navigate('/profile', { replace: true }), 900);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const message = code === 'phone_exists' ? 'phoneExists'
        : code === 'bad_name' ? 'badName'
        : code === 'bad_dob' || code === 'dob_in_future' ? 'badDob'
        : code === 'bad_gs' ? 'badDivision'
        : code === 'unauthorized' || code === 'session_expired' ? 'sessionExpired'
        : code === 'image_too_large' ? 'imageTooLarge'
        : code === 'bad_image' ? 'badImage'
        : uploading ? (detailsSaved ? 'photoPartial' : 'photoError') : 'error';
      setError(navigator.onLine ? t(`editProfile.${message}`) : t('creport.offline'));
    } finally {
      setSaving(false);
    }
  };
  return { avatarPreview, error, saving: saving || processing, saved, onFile, save };
}
