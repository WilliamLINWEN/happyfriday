// TypeScript type definitions for Bitbucket API data

export type TBitbucketAPIResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type TPullRequest = {
  id: number;
  title: string;
  description: string;
  state: string;
  author: {
    display_name: string;
    uuid: string;
  };
  created_on: string;
  updated_on: string;
  source: {
    branch: { name: string };
    repository: { full_name: string };
  };
  destination: {
    branch: { name: string };
    repository: { full_name: string };
  };
  links: {
    html: { href: string };
  };
};

export type TPullRequestDiff = {
  diff: string;
};
