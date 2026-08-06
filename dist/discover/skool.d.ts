import type { ContentItem, Fetcher } from '../types.js';
export interface CourseRef {
    id: string;
    title: string;
    hasAccess: boolean;
}
export declare function parseCourseList(payload: unknown): CourseRef[];
export interface Skipped {
    reason: string;
}
export interface CourseTreeResult {
    items: ContentItem[];
    skipped: Skipped[];
}
export declare function parseCourseTree(payload: unknown, courseTitle: string): CourseTreeResult;
export declare function listCourses(slug: string, fetcher: Fetcher): Promise<CourseRef[]>;
export declare function listLessons(slug: string, course: CourseRef, fetcher: Fetcher): Promise<CourseTreeResult>;
