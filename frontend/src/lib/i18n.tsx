import * as React from "react"

import type { HoldStatus } from "@/lib/api"

export type Language = "bn" | "en"

const STORAGE_KEY = "school-admission.language"
const DEFAULT_LANGUAGE: Language = "bn"

const CLASS_NAME = /^Class\s+(\d+)\s*-\s*(Morning|Evening)\s+Shift$/i

const en = {
  app: {
    title: "School Admission",
    adminSubtitle: "School administration · classes and seats",
    switchView: "Switch view",
    parents: "Parents",
    admin: "Admin",
    /** Label of the language button: the language it switches to. */
    otherLanguage: "বাংলা",
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
  },
  common: {
    cancel: "Cancel",
    keepIt: "No, keep it",
    dismiss: "Dismiss",
    class: "Class",
    status: "Status",
    held: "Held",
    confirmed: "Confirmed",
    available: "Available",
    studentName: "Student's name",
    contactNumber: "Contact number",
    couldNotLoadClasses: "Could not load classes",
    mayBeOutOfDate: " The numbers below may be out of date.",
    loadingClasses: "Loading classes…",
    applying: "Applying…",
  },
  shifts: { Morning: "Morning Shift", Evening: "Evening Shift" } as Record<string, string>,
  /** Class names are stored in English ("Class 6 - Morning Shift"); this is how they are shown. */
  className: (name: string) => name,
  classOption: (n: number) => `Class ${n}`,
  status: {
    HELD: "Seat held — pay the admission fee before the timer ends",
    CONFIRMED: "Confirmed",
    EXPIRED: "Expired — the fee was not paid in time and the seat was released",
    CANCELLED: "Cancelled",
    REMOVED: "Removed from the class by the school",
  } satisfies Record<HoldStatus, string>,
  parent: {
    menu: "Parent menu",
    classList: "Class List",
    admissionRequest: "Admission Request",
    myAdmission: "My Admission",
    requestDescription: "Your seat is held for a limited time. Pay the admission fee to confirm it.",
    admissionsDescription: "Every application for this student, with its current status.",
    enterStudentFirst: "Enter the student's 17-digit birth registration number at the top first.",
    seatHeld: (cls: string) =>
      `Seat held in ${cls}. Pay the admission fee before the timer runs out.`,
    noRequestTitle: "No admission request yet",
    noRequestNoStudent: "Enter the student's birth registration number above to see their request.",
    noRequestLoading: "Loading your requests…",
    noRequestNone: "Apply for a seat in a class first. Your request will show up here.",
    goToClassList: "Go to Class List",
  },
  studentId: {
    label: "Student birth registration number",
    placeholder: (n: number) => `${n} digits, e.g. 20152691234567890`,
    hint: (n: number) => `Enter all ${n} digits to apply for seats and see your applications.`,
    empty: "Enter the student's 17-digit birth registration number.",
    digitsOnly: "The birth registration number can contain digits only.",
    length: (n: number, entered: number) =>
      `The birth registration number must be exactly ${n} digits (you entered ${entered}).`,
  },
  classList: {
    title: "Classes",
    oneClassTitle: "One class per student",
    oneClass: (admitted: boolean, cls: string) =>
      `This student already ${admitted ? "is admitted to" : "has an application in"} ${cls}. ` +
      "Cancel it first to apply for a different class.",
    noClasses: "No classes are open for admission yet. Please check back soon.",
    total: "Total",
    admitted: "Admitted",
    applied: "Applied",
  },
  apply: {
    title: (cls: string) => `Apply for ${cls}`,
    forStudent: "For birth registration no.",
    heldOnSubmit: "A seat is held as soon as you submit.",
    nameRequired: "Enter the student's name.",
    nameTooLong: (n: number) => `The name can be at most ${n} characters.`,
    contactInvalid: "Enter a contact number of 10 to 15 digits, e.g. 01712345678.",
  },
  application: {
    title: "Application",
    empty: "Press “আবেদন করুন” on a class in the Class List, or open one from My Admission.",
    feePaid: "Fee paid",
    timeLeft: (time: string) => `Time left · expires at ${time}`,
    paidWarning:
      "The fee is already paid. Cancelling gives up this admission and the seat goes to someone else.",
    paying: "Paying…",
    yesCancel: "Yes, cancel",
    keepAdmission: "Keep admission",
    keepApplication: "Keep application",
    cancelling: "Cancelling…",
    paid: (cls: string) => `Admission fee received. Admission to ${cls} is confirmed.`,
    admissionCancelled: (cls: string) => `Admission to ${cls} cancelled. The seat was released.`,
    applicationCancelled: (cls: string) =>
      `Application for ${cls} cancelled. The seat was released.`,
  },
  myApplications: {
    title: "My applications",
    enterNumber: "Enter a birth registration number to see applications.",
    loading: "Loading applications…",
    none: "No applications yet.",
    applied: (date: string) => `Applied ${date}`,
  },
  createClass: {
    title: "Create class",
    description: "Each shift is its own class with its own seats.",
    shift: "Shift",
    totalSeats: "Total seats",
    selectClass: "Select class",
    selectShift: "Select shift",
    creating: "Creating…",
    chooseClass: "Choose a class (1 to 10).",
    chooseShift: "Choose a shift: Morning or Evening.",
    seatsWhole: "Total seats must be a whole number.",
    seatsRange: (max: number) => `Total seats must be between 1 and ${max}.`,
    created: (name: string, seats: number) => `Created “${name}” with ${seats} seats.`,
  },
  classGrid: {
    noClasses: "No classes yet. Create one with the form above.",
    capacity: "Capacity",
    footer: (available: number) => `${available} available · tap to see students`,
  },
  classDetail: {
    allClasses: "All classes",
    deleteClass: "Delete class",
    capacity: (n: number) => `Capacity ${n} students`,
    students: "Students",
    studentsDescription:
      "Students holding or admitted to a seat in this class. Updates every few seconds.",
    loadingStudents: "Loading students…",
    noStudents: "No students in this class yet.",
    student: "Student",
    contact: "Contact",
    applied: "Applied",
    removeLabel: (id: string) => `Remove ${id}`,
    remove: "Remove",
    removed: (id: string, cls: string) => `Removed ${id} from ${cls}. The seat is free again.`,
    deleted: (cls: string) => `Deleted ${cls}.`,
    removeTitle: "Remove this student?",
    removing: "Removing…",
    yesRemove: "Yes, remove",
    removeBody: (name: string, cls: string, paid: boolean) =>
      `Do you really want to remove ${name} from ${cls}?` +
      (paid ? " The admission fee is already paid." : "") +
      " The seat goes back to the pool.",
    deleteTitle: (cls: string) => `Delete ${cls}?`,
    deleting: "Deleting…",
    yesDelete: "Yes, delete",
    deleteBody: "Do you really want to delete this class? This cannot be undone.",
    loseSeats: (held: number, confirmed: number) =>
      `${held} held and ${confirmed} confirmed ${held + confirmed === 1 ? "student" : "students"} ` +
      "will lose their seat.",
  },
  errorBoundary: {
    title: "Something went wrong on this page",
    body: "Your applications are safe on the server. Reload the page to continue.",
    reload: "Reload page",
  },
  api: {
    network: "Cannot reach the server. Check your connection, or try again in a moment.",
    unknown: "Something unexpected went wrong. Please try again.",
    server: "The server ran into a problem. Please try again in a moment.",
    notFound: "The requested item was not found.",
    conflict: "This action conflicts with the current state. Refresh and try again.",
    badRequest: "The request was not accepted. Please check what you entered.",
    codes: {
      CLASS_FULL: "No seats are left in this class.",
      ALREADY_APPLIED: "You already have an active application for this class.",
      ALREADY_ADMITTED: "You are already admitted to this class.",
      HOLD_EXPIRED:
        "Time ran out before the fee was paid, so the seat was released. Apply again if seats are still available.",
      HOLD_CANCELLED: "This application was cancelled, so the fee can no longer be paid.",
      HOLD_REMOVED: "The school removed this student from the class.",
      STUDENT_NOT_IN_CLASS: "This student no longer has a seat in this class.",
      NOT_YOUR_HOLD: "This application belongs to a different student.",
      CLASS_NOT_FOUND: "This class no longer exists.",
      HOLD_NOT_FOUND: "This application could not be found.",
      CLASS_EXISTS: "A class with this name already exists.",
      MISSING_STUDENT_ID:
        "Enter the student's 17-digit birth registration number at the top first.",
      INVALID_STUDENT_ID: "The birth registration number must be exactly 17 digits.",
      TOO_MANY_REQUESTS: "Too many requests from your network. Please wait a minute and try again.",
      SERVER_BUSY: "The server is very busy right now. Please try again in a moment.",
      DATABASE_UNAVAILABLE: "The server cannot reach its database. Please try again in a moment.",
    } as Record<string, string>,
  },
}

export type Messages = typeof en

const bn: Messages = {
  app: {
    title: "স্কুল ভর্তি",
    adminSubtitle: "স্কুল প্রশাসন · শ্রেণি ও আসন",
    switchView: "ভিউ পরিবর্তন",
    parents: "অভিভাবক",
    admin: "অ্যাডমিন",
    otherLanguage: "English",
    toDark: "ডার্ক মোডে যান",
    toLight: "লাইট মোডে যান",
  },
  common: {
    cancel: "ফিরে যান",
    keepIt: "না, রাখুন",
    dismiss: "বন্ধ করুন",
    class: "শ্রেণি",
    status: "অবস্থা",
    held: "সংরক্ষিত",
    confirmed: "নিশ্চিত",
    available: "খালি",
    studentName: "শিক্ষার্থীর নাম",
    contactNumber: "যোগাযোগ নম্বর",
    couldNotLoadClasses: "শ্রেণির তালিকা লোড করা যায়নি",
    mayBeOutOfDate: " নিচের সংখ্যাগুলো পুরনো হতে পারে।",
    loadingClasses: "শ্রেণির তালিকা লোড হচ্ছে…",
    applying: "আবেদন হচ্ছে…",
  },
  shifts: { Morning: "প্রভাতি শাখা", Evening: "দিবা শাখা" },
  className: (name) => {
    const match = CLASS_NAME.exec(name.trim())
    if (!match) return name
    const shift = match[2].toLowerCase() === "morning" ? "প্রভাতি শাখা" : "দিবা শাখা"
    return `শ্রেণি ${match[1]} - ${shift}`
  },
  classOption: (n) => `শ্রেণি ${n}`,
  status: {
    HELD: "আসন সংরক্ষিত — সময় শেষ হওয়ার আগে ভর্তি ফি দিন",
    CONFIRMED: "নিশ্চিত",
    EXPIRED: "মেয়াদ শেষ — সময়মতো ফি না দেওয়ায় আসনটি ছেড়ে দেওয়া হয়েছে",
    CANCELLED: "বাতিল করা হয়েছে",
    REMOVED: "স্কুল এই শিক্ষার্থীকে শ্রেণি থেকে সরিয়ে দিয়েছে",
  },
  parent: {
    menu: "অভিভাবক মেনু",
    classList: "শ্রেণির তালিকা",
    admissionRequest: "ভর্তির আবেদন",
    myAdmission: "আমার ভর্তি",
    requestDescription: "আপনার আসন নির্দিষ্ট সময়ের জন্য সংরক্ষিত। নিশ্চিত করতে ভর্তি ফি দিন।",
    admissionsDescription: "এই শিক্ষার্থীর সব আবেদন ও সেগুলোর বর্তমান অবস্থা।",
    enterStudentFirst: "প্রথমে উপরে শিক্ষার্থীর ১৭ সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।",
    seatHeld: (cls) => `${cls}-এ আসন সংরক্ষিত হয়েছে। সময় শেষ হওয়ার আগে ভর্তি ফি দিন।`,
    noRequestTitle: "এখনো কোনো ভর্তির আবেদন নেই",
    noRequestNoStudent: "আবেদন দেখতে উপরে শিক্ষার্থীর জন্ম নিবন্ধন নম্বর লিখুন।",
    noRequestLoading: "আপনার আবেদন লোড হচ্ছে…",
    noRequestNone: "আগে কোনো শ্রেণিতে আসনের জন্য আবেদন করুন। আপনার আবেদন এখানে দেখা যাবে।",
    goToClassList: "শ্রেণির তালিকায় যান",
  },
  studentId: {
    label: "শিক্ষার্থীর জন্ম নিবন্ধন নম্বর",
    placeholder: (n) => `${n} সংখ্যা, যেমন 20152691234567890`,
    hint: (n) => `আসনের জন্য আবেদন করতে ও আবেদন দেখতে ${n}টি সংখ্যাই লিখুন।`,
    empty: "শিক্ষার্থীর ১৭ সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।",
    digitsOnly: "জন্ম নিবন্ধন নম্বরে শুধু সংখ্যা থাকতে পারে।",
    length: (n, entered) =>
      `জন্ম নিবন্ধন নম্বর ঠিক ${n} সংখ্যার হতে হবে (আপনি ${entered}টি লিখেছেন)।`,
  },
  classList: {
    title: "শ্রেণিসমূহ",
    oneClassTitle: "প্রতি শিক্ষার্থী একটি শ্রেণি",
    oneClass: (admitted, cls) =>
      (admitted
        ? `এই শিক্ষার্থী ইতিমধ্যে ${cls}-এ ভর্তি হয়েছে।`
        : `এই শিক্ষার্থীর ইতিমধ্যে ${cls}-এ একটি আবেদন আছে।`) +
      " অন্য শ্রেণিতে আবেদন করতে আগে সেটি বাতিল করুন।",
    noClasses: "এখনো কোনো শ্রেণিতে ভর্তি শুরু হয়নি। কিছুক্ষণ পরে আবার দেখুন।",
    total: "মোট",
    admitted: "ভর্তি হয়েছে",
    applied: "আবেদন করা হয়েছে",
  },
  apply: {
    title: (cls) => `${cls}-এ আবেদন`,
    forStudent: "জন্ম নিবন্ধন নম্বর",
    heldOnSubmit: "জমা দেওয়ার সাথে সাথে একটি আসন সংরক্ষিত হবে।",
    nameRequired: "শিক্ষার্থীর নাম লিখুন।",
    nameTooLong: (n) => `নাম সর্বোচ্চ ${n} অক্ষরের হতে পারে।`,
    contactInvalid: "১০ থেকে ১৫ সংখ্যার একটি যোগাযোগ নম্বর লিখুন, যেমন 01712345678।",
  },
  application: {
    title: "আবেদন",
    empty: "শ্রেণির তালিকা থেকে কোনো শ্রেণির “আবেদন করুন” চাপুন, অথবা আমার ভর্তি থেকে একটি আবেদন খুলুন।",
    feePaid: "ফি পরিশোধ",
    timeLeft: (time) => `বাকি সময় · মেয়াদ শেষ ${time}`,
    paidWarning: "ফি ইতিমধ্যে পরিশোধ করা হয়েছে। বাতিল করলে এই ভর্তি বাতিল হবে এবং আসনটি অন্য কেউ পাবে।",
    paying: "পরিশোধ হচ্ছে…",
    yesCancel: "হ্যাঁ, বাতিল করুন",
    keepAdmission: "ভর্তি রাখুন",
    keepApplication: "আবেদন রাখুন",
    cancelling: "বাতিল হচ্ছে…",
    paid: (cls) => `ভর্তি ফি পাওয়া গেছে। ${cls}-এ ভর্তি নিশ্চিত হয়েছে।`,
    admissionCancelled: (cls) => `${cls}-এ ভর্তি বাতিল হয়েছে। আসনটি ছেড়ে দেওয়া হয়েছে।`,
    applicationCancelled: (cls) => `${cls}-এর আবেদন বাতিল হয়েছে। আসনটি ছেড়ে দেওয়া হয়েছে।`,
  },
  myApplications: {
    title: "আমার আবেদন",
    enterNumber: "আবেদন দেখতে জন্ম নিবন্ধন নম্বর লিখুন।",
    loading: "আবেদন লোড হচ্ছে…",
    none: "এখনো কোনো আবেদন নেই।",
    applied: (date) => `আবেদন: ${date}`,
  },
  createClass: {
    title: "শ্রেণি তৈরি করুন",
    description: "প্রতিটি শাখা আলাদা শ্রেণি, যার নিজস্ব আসন আছে।",
    shift: "শাখা",
    totalSeats: "মোট আসন",
    selectClass: "শ্রেণি বাছাই করুন",
    selectShift: "শাখা বাছাই করুন",
    creating: "তৈরি হচ্ছে…",
    chooseClass: "একটি শ্রেণি বাছাই করুন (১ থেকে ১০)।",
    chooseShift: "একটি শাখা বাছাই করুন: প্রভাতি বা দিবা।",
    seatsWhole: "মোট আসন একটি পূর্ণ সংখ্যা হতে হবে।",
    seatsRange: (max) => `মোট আসন ১ থেকে ${max}-এর মধ্যে হতে হবে।`,
    created: (name, seats) => `“${name}” তৈরি হয়েছে, আসন ${seats}টি।`,
  },
  classGrid: {
    noClasses: "এখনো কোনো শ্রেণি নেই। উপরের ফর্ম দিয়ে একটি তৈরি করুন।",
    capacity: "ধারণক্ষমতা",
    footer: (available) => `${available}টি খালি · শিক্ষার্থী দেখতে চাপুন`,
  },
  classDetail: {
    allClasses: "সব শ্রেণি",
    deleteClass: "শ্রেণি মুছুন",
    capacity: (n) => `ধারণক্ষমতা ${n} জন শিক্ষার্থী`,
    students: "শিক্ষার্থী",
    studentsDescription: "এই শ্রেণিতে আসন সংরক্ষিত বা ভর্তি হওয়া শিক্ষার্থীরা। কয়েক সেকেন্ড পরপর হালনাগাদ হয়।",
    loadingStudents: "শিক্ষার্থীদের তালিকা লোড হচ্ছে…",
    noStudents: "এই শ্রেণিতে এখনো কোনো শিক্ষার্থী নেই।",
    student: "শিক্ষার্থী",
    contact: "যোগাযোগ",
    applied: "আবেদনের সময়",
    removeLabel: (id) => `${id} সরান`,
    remove: "সরান",
    removed: (id, cls) => `${cls} থেকে ${id} সরানো হয়েছে। আসনটি আবার খালি।`,
    deleted: (cls) => `${cls} মুছে ফেলা হয়েছে।`,
    removeTitle: "এই শিক্ষার্থীকে সরাবেন?",
    removing: "সরানো হচ্ছে…",
    yesRemove: "হ্যাঁ, সরান",
    removeBody: (name, cls, paid) =>
      `আপনি কি সত্যিই ${cls} থেকে ${name}-কে সরাতে চান?` +
      (paid ? " ভর্তি ফি ইতিমধ্যে পরিশোধ করা হয়েছে।" : "") +
      " আসনটি আবার খালি হবে।",
    deleteTitle: (cls) => `${cls} মুছবেন?`,
    deleting: "মোছা হচ্ছে…",
    yesDelete: "হ্যাঁ, মুছুন",
    deleteBody: "আপনি কি সত্যিই এই শ্রেণি মুছতে চান? এটি আর ফেরানো যাবে না।",
    loseSeats: (held, confirmed) =>
      `${held} জন সংরক্ষিত ও ${confirmed} জন নিশ্চিত শিক্ষার্থী তাদের আসন হারাবে।`,
  },
  errorBoundary: {
    title: "এই পাতায় একটি সমস্যা হয়েছে",
    body: "আপনার আবেদন সার্ভারে নিরাপদে আছে। চালিয়ে যেতে পাতাটি আবার লোড করুন।",
    reload: "পাতা আবার লোড করুন",
  },
  api: {
    network: "সার্ভারে সংযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন, অথবা কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    unknown: "অপ্রত্যাশিত একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    server: "সার্ভারে একটি সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    notFound: "যা খোঁজা হয়েছে তা পাওয়া যায়নি।",
    conflict: "বর্তমান অবস্থার সাথে এই কাজটি মেলে না। পাতা হালনাগাদ করে আবার চেষ্টা করুন।",
    badRequest: "অনুরোধটি গ্রহণ করা হয়নি। আপনি যা লিখেছেন তা দেখুন।",
    codes: {
      CLASS_FULL: "এই শ্রেণিতে আর কোনো আসন খালি নেই।",
      ALREADY_APPLIED: "এই শ্রেণিতে আপনার একটি চলমান আবেদন আছে।",
      ALREADY_ADMITTED: "আপনি ইতিমধ্যে এই শ্রেণিতে ভর্তি হয়েছেন।",
      HOLD_EXPIRED:
        "ফি দেওয়ার আগেই সময় শেষ হয়ে গেছে, তাই আসনটি ছেড়ে দেওয়া হয়েছে। আসন খালি থাকলে আবার আবেদন করুন।",
      HOLD_CANCELLED: "এই আবেদনটি বাতিল করা হয়েছে, তাই এখন আর ফি দেওয়া যাবে না।",
      HOLD_REMOVED: "স্কুল এই শিক্ষার্থীকে শ্রেণি থেকে সরিয়ে দিয়েছে।",
      STUDENT_NOT_IN_CLASS: "এই শিক্ষার্থীর এই শ্রেণিতে আর কোনো আসন নেই।",
      NOT_YOUR_HOLD: "এই আবেদনটি অন্য একজন শিক্ষার্থীর।",
      CLASS_NOT_FOUND: "এই শ্রেণিটি আর নেই।",
      HOLD_NOT_FOUND: "এই আবেদনটি খুঁজে পাওয়া যায়নি।",
      CLASS_EXISTS: "এই নামে একটি শ্রেণি আগে থেকেই আছে।",
      MISSING_STUDENT_ID: "প্রথমে উপরে শিক্ষার্থীর ১৭ সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।",
      INVALID_STUDENT_ID: "জন্ম নিবন্ধন নম্বর ঠিক ১৭ সংখ্যার হতে হবে।",
      ALREADY_IN_ANOTHER_CLASS: "এই শিক্ষার্থীর অন্য একটি শ্রেণিতে আবেদন বা ভর্তি আছে।",
      INVALID_STUDENT_NAME: "শিক্ষার্থীর নাম লিখুন (সর্বোচ্চ ১০০ অক্ষর)।",
      INVALID_CONTACT_NUMBER: "১০ থেকে ১৫ সংখ্যার একটি যোগাযোগ নম্বর লিখুন, যেমন 01712345678।",
      INVALID_NAME: "শ্রেণির নাম সঠিক নয়।",
      INVALID_TOTAL_SEATS: "মোট আসন ১ থেকে ১,০০,০০০-এর মধ্যে একটি পূর্ণ সংখ্যা হতে হবে।",
      TOO_MANY_REQUESTS: "আপনার নেটওয়ার্ক থেকে অনেক বেশি অনুরোধ এসেছে। এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।",
      SERVER_BUSY: "সার্ভার এখন খুব ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
      DATABASE_UNAVAILABLE: "সার্ভার ডেটাবেসে সংযোগ করতে পারছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    },
  },
}

const MESSAGES: Record<Language, Messages> = { bn, en }

function isLanguage(value: unknown): value is Language {
  return value === "bn" || value === "en"
}

// Storage can be unavailable (private mode, blocked site data); the default is used then.
export function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

// The current language also lives outside React, so plain helpers (API errors, validators) can
// use it. The provider keeps it in step and re-renders the UI when it changes.
let current: Language = loadLanguage()

/** Messages in the current language, for code outside React components. */
export function messages(): Messages {
  return MESSAGES[current]
}

export function setLanguage(language: Language) {
  current = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not persisted; the choice still holds for this session.
  }
  if (typeof document !== "undefined") document.documentElement.lang = language
}

type LanguageState = { language: Language; setLanguage: (language: Language) => void }

const LanguageContext = React.createContext<LanguageState | null>(null)

/** Bangla by default; the choice is remembered across reloads. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setState] = React.useState<Language>(() => current)

  React.useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = React.useMemo<LanguageState>(
    () => ({
      language,
      setLanguage: (next) => {
        setLanguage(next)
        setState(next)
      },
    }),
    [language]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageState {
  // Outside the provider (e.g. a component rendered alone in a test) the module's language is used.
  return React.useContext(LanguageContext) ?? { language: current, setLanguage }
}

/** The messages for the current language; components using it re-render when it changes. */
export function useT(): Messages {
  return MESSAGES[useLanguage().language]
}
