export type SellerGradeId = "starter" | "bronze" | "silver" | "gold" | "diamond";

export interface SellerGrade {
  grade: SellerGradeId;
  label: string;
  thresholdOre: number;
  nextGrade: {
    grade: SellerGradeId;
    label: string;
    remainingOre: number;
  } | null;
}

export interface Campaign {
  id: string;
  orgId: string;
  name: string;
  story: string | null;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  startDate: string | null;
  endDate: string | null;
  goalType: "AMOUNT" | "PACKAGES" | null;
  goalValue: number | null;
  marginPercent: number;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  memberCount: number;
  leaderId: string;
  totalSalesOre: number;
  orderCount: number;
  goalValue: number;
  inviteToken: string;
}

export interface Seller {
  id: string;
  displayName: string;
  shopSlug: string;
  totalSalesOre: number;
  orderCount: number;
  individualGoal: number | null;
  grade?: SellerGrade;
  // Sprint E12: team leaders can pause sellers; paused sellers stay in
  // the list (for transparency) but are excluded from ranking + targets.
  // Optional so older API responses keep validating.
  status?: "ACTIVE" | "INACTIVE";
}

export interface CustomerOrder {
  id: string;
  customerName: string;
  customerEmail: string | null;
  totalOre: number;
  status: string;
  paymentMethod: string | null;
  deliveryType: string | null;
  sellerId: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  label: string;
  description: string;
}

export interface MilestoneNext {
  label: string;
  remaining: number;
}

export interface AssociationDashboard {
  campaigns: Campaign[];
  teams: Team[];
  sellers: Array<{
    id: string;
    displayName: string;
    teamId: string;
    shopSlug: string;
  }>;
  stats: {
    totalSalesOre: number;
    totalOrders: number;
  };
}

export interface TeamDashboard {
  team: {
    id: string;
    name: string;
    campaignId: string;
    orgId: string;
    memberCount: number;
    inviteToken: string;
  };
  campaign: (Campaign & { marginPercent: number }) | null;
  sellers: Seller[];
  orders: CustomerOrder[];
  stats: {
    totalSalesOre: number;
    totalOrders: number;
    teamEarningsOre: number;
    marginPercent: number;
  };
  milestones: {
    achieved: Milestone[];
    next: MilestoneNext | null;
  };
}

export interface SellerDashboard {
  seller: {
    id: string;
    displayName: string;
    shopSlug: string;
    campaignId: string;
    teamId: string;
    individualGoal?: number | null;
  };
  team: { id: string; name: string } | null;
  campaign: { id: string; name: string; story: string | null; marginPercent: number } | null;
  stats: {
    totalSalesOre: number;
    orderCount: number;
    estimatedEarningsOre: number;
  };
  grade?: SellerGrade;
  milestones: {
    achieved: Milestone[];
    next: MilestoneNext | null;
  };
  orders: Array<{
    id: string;
    customerName: string;
    totalOre: number;
    status: string;
    createdAt: string;
  }>;
}
