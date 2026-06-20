import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCats, getCat, getSightings, getPosts, getPost,
  getGalleryImages, getNearbyCats, getHeatmapData,
  getUserProfile, getMyStats, getDailyQuest, getLeaderboard,
  getBadges, getFollowedCats, getNotifications,
  createPost, createSighting, likePost, followCat,
} from '../api'

export function useCats(params?) {
  return useQuery({
    queryKey: ['cats', params],
    queryFn: () => getCats(),
  })
}

export function useCat(id) {
  return useQuery({
    queryKey: ['cats', id],
    queryFn: () => getCat(id),
    enabled: !!id,
  })
}

export function useSightings(params = {}) {
  return useQuery({
    queryKey: ['sightings', params],
    queryFn: () => getSightings(params),
  })
}

export function usePosts(params = {}) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: () => getPosts(params),
  })
}

export function usePost(id) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => getPost(id),
    enabled: !!id,
  })
}

export function useGallery(params = {}) {
  return useQuery({
    queryKey: ['gallery', params],
    queryFn: () => getGalleryImages(params),
  })
}

export function useNearbyCats(lat, lng, radius?) {
  return useQuery({
    queryKey: ['nearbyCats', lat, lng, radius],
    queryFn: () => getNearbyCats(lat, lng, radius),
    enabled: lat != null && lng != null,
  })
}

export function useHeatmap(days?) {
  return useQuery({
    queryKey: ['heatmap', days],
    queryFn: () => getHeatmapData({ days, limit: 100 }),
  })
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: getUserProfile,
  })
}

export function useMyStats() {
  return useQuery({
    queryKey: ['myStats'],
    queryFn: getMyStats,
  })
}

export function useDailyQuest() {
  return useQuery({
    queryKey: ['dailyQuest'],
    queryFn: getDailyQuest,
  })
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  })
}

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    queryFn: getBadges,
  })
}

export function useFollows() {
  return useQuery({
    queryKey: ['follows'],
    queryFn: getFollowedCats,
  })
}

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params),
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormData) => createPost(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }) },
  })
}

export function useCreateSighting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof createSighting>[0]) => createSighting(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sightings'] }) },
  })
}

export function useLikePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: number | string) => likePost(postId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }) },
  })
}

export function useFollowCat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (catId: number | string) => followCat(catId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follows'] }) },
  })
}

export function useInfinitePosts(params = {}) {
  return useInfiniteQuery({
    queryKey: ['posts', 'infinite', params],
    queryFn: ({ pageParam = 1 }) => getPosts({ ...params, page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && typeof lastPage === 'object' && !Array.isArray(lastPage)) {
        return lastPage.has_more ? allPages.length + 1 : undefined
      }
      const arr = Array.isArray(lastPage) ? lastPage : []
      return arr.length >= 20 ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
  })
}

export function useInfiniteSightings(params = {}) {
  return useInfiniteQuery({
    queryKey: ['sightings', 'infinite', params],
    queryFn: ({ pageParam = 1 }) => getSightings({ ...params, page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && typeof lastPage === 'object' && !Array.isArray(lastPage)) {
        return lastPage.has_more ? allPages.length + 1 : undefined
      }
      const arr = Array.isArray(lastPage) ? lastPage : []
      return arr.length >= 20 ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
  })
}

export function useInfiniteGallery(params = {}) {
  return useInfiniteQuery({
    queryKey: ['gallery', 'infinite', params],
    queryFn: ({ pageParam = 1 }) => getGalleryImages({ ...params, page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && typeof lastPage === 'object' && !Array.isArray(lastPage)) {
        return lastPage.has_more ? allPages.length + 1 : undefined
      }
      const arr = Array.isArray(lastPage) ? lastPage : []
      return arr.length >= 20 ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
  })
}
