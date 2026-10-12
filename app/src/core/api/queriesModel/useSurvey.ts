import { api } from '@/core/api';
import { keys } from '@/core/api/queriesModel/keys';
import { useQuery } from '@tanstack/react-query';
export const useSurvey = () => useQuery({ queryKey: keys.survey, queryFn: () => api.getSurvey() });
