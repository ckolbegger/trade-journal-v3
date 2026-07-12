import { createContext, useContext } from 'react'
import type { Review } from '@/coordinators/review'

export const ReviewContext = createContext<Review | null>(null)

export function useReview(): Review {
  const review = useContext(ReviewContext)
  if (!review) throw new Error('Review not provided')
  return review
}
