import { useQuery } from '@tanstack/react-query'
import { fetchers } from '../api/client'

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: fetchers.meta, staleTime: Infinity })
