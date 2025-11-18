// Core types for Josh Wright's portfolio site

export interface CaseStudy {
  slug: string;
  data: CaseStudyData;
  body?: string;
}

export interface CaseStudyData {
  title: string;
  subtitle: string;
  thumbnail: string;
  banner?: string;
  tags: string[];
  featured?: boolean;
  password?: string;
  outcomes?: Outcome[];
}

export interface Outcome {
  stat: string;
  description: string;
  colorClass?: string;
  variant?: 'default' | 'text-only';
}

export interface ProjectDetails {
  goal: string;
  responsibilities: string;
  duration: string;
}

export interface FeaturedQuote {
  quote: string;
  authorName: string;
  authorTitle: string;
  authorImage: string;
}

export interface Testimonial {
  name: string;
  title?: string;
  portrait: string;
  quote: string;
}

export interface Skill {
  title: string;
  description: string;
  icon: string;
}

export interface HomepageData {
  heroTitle: string;
  methodology: {
    title: string;
    skills: Skill[];
  };
  featuredQuote: FeaturedQuote;
  about: {
    title: string;
    heading: string;
    content: string;
    bannerImage: string;
  };
}

export interface CardProps {
  href: string;
  title: string;
  img: string;
  isPasswordProtected?: boolean;
}

export interface LayoutProps {
  title: string;
  currentNav?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

export interface TestimonialProps {
  name: string;
  title?: string;
  portrait: string;
  quote: string;
}

export interface SkillProps {
  title: string;
  description: string;
  img: string;
}

export interface VideoProps {
  playbackId: string;
  title: string;
  poster?: string;
}

export interface EnhancedOutcomeGridProps {
  outcomes: Outcome[];
  columns?: number;
  animateOnScroll?: boolean;
}

export interface ResponsiveImageProps {
  src: string;
  mobileSrc?: string;
  alt: string;
  maxHeight?: string;
  maxHeightMobile?: string;
  contain?: boolean;
  priority?: boolean;
}

export interface TableProps {
  headers: string[];
  rows: (string | number)[][];
  variant?: 'default' | 'compact' | 'striped';
}

export interface ConversationExchangeProps {
  exchanges: {
    speaker: string;
    message: string;
    type?: 'question' | 'answer' | 'insight';
  }[];
}

export interface ParticipantInsightsProps {
  participants: {
    name: string;
    role: string;
    insights: string[];
    avatar?: string;
  }[];
}
