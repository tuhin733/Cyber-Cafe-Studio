export interface ApplicationTemplate {
  id: string;
  category: string;
  subcategory: string;
  title: string;
}

const groups = [
  {
    category: "School & College Applications",
    sections: [
      {
        subcategory: "Attendance & Leave",
        titles: [
          "Sick Leave Application (Self / Doctor’s Advice)",
          "Casual / Planned Leave Application (Family Event / Travel)",
          "Hostel Leave / Out-Pass Application",
          "Half-Day / Early Leave Request Application",
          "Application for Attendance Shortage Condonation (Due to Medical Emergency)",
        ],
      },
      {
        subcategory: "Certificates & Records",
        titles: [
          "Transfer Certificate (TC) Application",
          "Bonafide Certificate Application (For Passport, Bank Account, Bus Pass)",
          "Character / Conduct Certificate Application",
          "Migration Certificate Application",
          "Provisional / Original Degree Certificate Application",
          "Correction in Marksheet / Certificate Application (Name, DOB, Roll No.)",
        ],
      },
      {
        subcategory: "Financial & Administrative",
        titles: [
          "Fee Concession / Tuition Fee Waiver Application",
          "Late Fee Fine Waiver Application",
          "Scholarship Application",
          "Stream / Subject / Elective Change Application",
          "Re-evaluation / Answer Sheet Photocopy Application",
          "Make-up / Re-examination Permission Application",
          "Hostel Room Allotment / Relinquishment Application",
        ],
      },
    ],
  },
  {
    category: "Workplace & HR Applications",
    sections: [
      {
        subcategory: "Leave Management",
        titles: [
          "Casual Leave / Annual Leave Application",
          "Sick Leave Application",
          "Maternity / Paternity Leave Application",
          "Sabbatical / Unpaid Leave (LWP) Application",
          "Half-Day / Short Leave Request Application",
        ],
      },
      {
        subcategory: "Salary, Finance & Benefits",
        titles: [
          "Medical Allowance Claim / Reimbursement Application",
          "Travel / Conveyance Allowance Reimbursement Claim",
          "Salary Advance / Personal Loan Request Application",
          "Pay Slip / Salary Certificate Request Application",
          "PF (Provident Fund) Partial Withdrawal Application",
        ],
      },
      {
        subcategory: "Work Arrangements & Operations",
        titles: [
          "Work From Home (WFH) / Remote Work Application",
          "Shift Change / Working Hours Modification Request",
          "ID Card / Laptop Re-issuance Application",
        ],
      },
      {
        subcategory: "Career Progression & Exit",
        titles: [
          "Resignation Letter / Application",
          "Experience & Relieving Certificate Request Application",
          "Notice Period Buyout Request Application",
          "Internal Job Transfer / Department Change Request",
          "Internship / Project Training Completion Certificate Request",
        ],
      },
    ],
  },
  {
    category: "Bank & Financial Applications",
    sections: [
      {
        subcategory: "Account Maintenance",
        titles: [
          "Application to Open New Bank Account (Savings / Current / FD)",
          "Re-KYC / KYC Update Application",
          "Mobile Number / Email ID Change Application",
          "Correspondence Address Change Application",
          "Unfreeze / Reactivate Dormant Account Application",
          "Bank Account Closure Request Application",
          "Nomination Addition / Modification Application",
        ],
      },
      {
        subcategory: "Payment Tools & Disputes",
        titles: [
          "New Cheque Book Request Application",
          "Stop Cheque Payment Application",
          "New / Replacement Debit (ATM) Card Application",
          "Blocked / PIN Reset Debit Card Request",
          "Failed Transaction / Failed ATM Cash Dispute Application",
          "Unauthorized Credit / Debit Chargeback Claim Application",
        ],
      },
      {
        subcategory: "Services, Loans & Statements",
        titles: [
          "Bank Statement / Solvency Certificate Application",
          "Loan Pre-Closure / Foreclosure Request Application",
          "NOC (No Objection Certificate) Request for Closed Loan",
          "Interest Rate Reduction Request Application (Floating Home Loans)",
        ],
      },
    ],
  },
  {
    category: "Government & Civic Applications",
    sections: [
      {
        subcategory: "Public Information & Rights",
        titles: [
          "RTI (Right to Information) Initial Application (Under Section 6(1))",
          "RTI First Appeal Application (Under Section 19(1))",
        ],
      },
      {
        subcategory: "Municipal & Local Civic Complaints",
        titles: [
          "Public Utility Complaint (Streetlight Repair, Drainage, Garbage Clearance)",
          "Water Supply Connection / Water Leakage Complaint Application",
          "Road Repair / Pothole Maintenance Request Application",
          "Nuisance Complaint (Illegal Construction, Encroachment, Noise Pollution)",
        ],
      },
      {
        subcategory: "Identity, Civil Records & Utilities",
        titles: [
          "Correction in Name / Address / DOB (Aadhaar, Voter ID, Ration Card)",
          "Application for New Electricity Meter / Tariff Category Change",
          "Property Tax Record Name Mutation / Correction Application",
          "Birth / Death Certificate Correction Application",
          "Trade License / Food Safety (FSSAI) Application Request",
        ],
      },
    ],
  },
  {
    category: "Personal & Residential Applications",
    sections: [
      {
        subcategory: "Housing Society & Apartments",
        titles: [
          "Society NOC Request (Interior Renovation, Move-In / Move-Out)",
          "EV Charger Installation Permission Application",
          "Society Maintenance Issue / Lift Repair Complaint Application",
          "Parking Slot Allotment / Vehicle Registration Request",
        ],
      },
      {
        subcategory: "Landlord & Rental",
        titles: [
          "Rent Agreement Termination Notice Application",
          "Request for Refund of Security Deposit",
          "Maintenance & Urgent Repairs Request to Landlord",
          "Tenant Residency Proof / NOC Request",
        ],
      },
    ],
  },
  {
    category: "Police & Legal Applications",
    sections: [
      {
        subcategory: "Police & Security",
        titles: [
          "Intimation of Lost Document / Item (NCR - Non-Cognizable Report for Aadhaar, DL, Passport)",
          "FIR Registration Request (Theft, Burglary, Physical Assault)",
          "Cyber Crime / Online Financial Fraud Complaint Application",
          "Tenant / Domestic Help Police Verification Application",
          "Loudspeaker / Event Permission Application",
        ],
      },
      {
        subcategory: "Judicial & Court Matters",
        titles: [
          "Application for Adjournment of Hearing (Court Case)",
          "Application for Exemption from Personal Appearance",
          "Application for Certified Copy of Order / Judgment",
          "Statutory Legal Notice Reply Application",
        ],
      },
    ],
  },
] as const;

export const APPLICATION_TEMPLATE_GROUPS = groups;

export const APPLICATION_TEMPLATES: ApplicationTemplate[] = groups.flatMap(
  ({ category, sections }) =>
    sections.flatMap(({ subcategory, titles }) =>
      titles.map((title) => ({
        id: `${category}-${subcategory}-${title}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        category,
        subcategory,
        title,
      })),
    ),
);
