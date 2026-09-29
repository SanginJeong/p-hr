"use client";

import { useState } from "react";
import {
  CalendarIcon,
  ChevronRightIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TEAMS = [
  { label: "개발팀", value: "dev" },
  { label: "디자인팀", value: "design" },
  { label: "인사팀", value: "hr" },
];

const ATTENDANCE = [
  { name: "김민수", team: "개발팀", clockIn: "09:02", clockOut: "18:10", status: "정상" },
  { name: "이서연", team: "디자인팀", clockIn: "09:34", clockOut: "18:40", status: "지각" },
  { name: "박지훈", team: "인사팀", clockIn: "08:55", clockOut: "-", status: "근무중" },
  { name: "최유나", team: "개발팀", clockIn: "-", clockOut: "-", status: "휴가" },
] as const;

const STATUS_VARIANT = {
  정상: "secondary",
  지각: "destructive",
  근무중: "default",
  휴가: "outline",
} as const;

const SECTIONS = [
  "Button",
  "Badge",
  "Avatar",
  "Card",
  "Form",
  "Select",
  "Table",
  "Tabs",
  "Calendar",
  "Overlays",
  "Dropdown Menu",
  "Tooltip & Toast",
  "Pagination",
  "Skeleton",
  "Scroll Area",
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: (typeof SECTIONS)[number];
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={title} className="scroll-mt-8 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border p-6">{children}</div>
    </section>
  );
}

export default function UiComponentsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showWeekend, setShowWeekend] = useState(true);
  const [sort, setSort] = useState("name");

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 md:px-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">UI Components</h1>
          <p className="text-muted-foreground">
            프로젝트에 추가된 shadcn/ui 컴포넌트 모음입니다.
          </p>
          <nav className="flex flex-wrap gap-1.5">
            {SECTIONS.map((section) => (
              <Badge
                key={section}
                variant="outline"
                render={<a href={`#${section}`} />}
              >
                {section}
              </Badge>
            ))}
          </nav>
        </header>

        <Section title="Button" description="variant와 size 조합">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="추가">
                <PlusIcon />
              </Button>
              <Button disabled>Disabled</Button>
              <Button variant="outline">
                <PlusIcon data-icon="inline-start" />
                직원 추가
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Badge" description="상태 표시용 라벨">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>
        </Section>

        <Section title="Avatar" description="사이즈, 배지, 그룹">
          <div className="flex flex-wrap items-center gap-6">
            <Avatar size="sm">
              <AvatarFallback>김</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>이</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>박</AvatarFallback>
              <AvatarBadge className="bg-green-500" />
            </Avatar>
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>김</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>이</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>박</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+5</AvatarGroupCount>
            </AvatarGroup>
          </div>
        </Section>

        <Section title="Card" description="헤더, 액션, 본문, 푸터">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>오늘의 근태</CardTitle>
                <CardDescription>2026년 9월 29일 기준</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon-sm" aria-label="더보기">
                    <MoreHorizontalIcon />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-semibold">42</p>
                  <p className="text-xs text-muted-foreground">출근</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">3</p>
                  <p className="text-xs text-muted-foreground">지각</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">5</p>
                  <p className="text-xs text-muted-foreground">휴가</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  전체 보기
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Small card</CardTitle>
                <CardDescription>size=&quot;sm&quot;</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                조금 더 촘촘한 간격의 카드입니다.
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section
          title="Form"
          description="Field, Input, Textarea, Checkbox, Switch, Label"
        >
          <FieldSet className="max-w-md">
            <FieldLegend>직원 정보</FieldLegend>
            <FieldDescription>새 직원의 기본 정보를 입력하세요.</FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">이름</FieldLabel>
                <Input id="name" placeholder="홍길동" />
              </Field>
              <Field data-invalid>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  defaultValue="invalid-email"
                  aria-invalid
                />
                <FieldError>올바른 이메일 형식이 아닙니다.</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="memo">메모</FieldLabel>
                <Textarea id="memo" placeholder="특이사항을 입력하세요" />
                <FieldDescription>최대 500자까지 입력할 수 있어요.</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="admin" />
                <FieldLabel htmlFor="admin">관리자 권한 부여</FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch id="notify" defaultChecked />
                <Label htmlFor="notify">출퇴근 알림 받기</Label>
              </Field>
              <Field>
                <Input disabled placeholder="Disabled input" />
              </Field>
            </FieldGroup>
          </FieldSet>
        </Section>

        <Section title="Select" description="그룹, 라벨, 사이즈">
          <div className="flex flex-wrap items-center gap-4">
            <Select items={TEAMS}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>팀</SelectLabel>
                  {TEAMS.map((team) => (
                    <SelectItem key={team.value} value={team.value}>
                      {team.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select items={TEAMS} defaultValue="dev">
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((team) => (
                  <SelectItem key={team.value} value={team.value}>
                    {team.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Table" description="근태 목록 예시">
          <Table>
            <TableCaption>2026년 9월 29일 근태 현황</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>팀</TableHead>
                <TableHead>출근</TableHead>
                <TableHead>퇴근</TableHead>
                <TableHead className="text-right">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ATTENDANCE.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.team}</TableCell>
                  <TableCell>{row.clockIn}</TableCell>
                  <TableCell>{row.clockOut}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>합계</TableCell>
                <TableCell className="text-right">{ATTENDANCE.length}명</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Section>

        <Section title="Tabs" description="default / line variant">
          <div className="grid gap-8 md:grid-cols-2">
            <Tabs defaultValue="daily">
              <TabsList>
                <TabsTrigger value="daily">일간</TabsTrigger>
                <TabsTrigger value="weekly">주간</TabsTrigger>
                <TabsTrigger value="monthly">월간</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="pt-2 text-sm">
                일간 근태 요약
              </TabsContent>
              <TabsContent value="weekly" className="pt-2 text-sm">
                주간 근태 요약
              </TabsContent>
              <TabsContent value="monthly" className="pt-2 text-sm">
                월간 근태 요약
              </TabsContent>
            </Tabs>
            <Tabs defaultValue="members">
              <TabsList variant="line">
                <TabsTrigger value="members">팀원</TabsTrigger>
                <TabsTrigger value="policy">정책</TabsTrigger>
                <TabsTrigger value="history">변경 이력</TabsTrigger>
              </TabsList>
              <TabsContent value="members" className="pt-2 text-sm">
                팀원 목록
              </TabsContent>
              <TabsContent value="policy" className="pt-2 text-sm">
                근무 정책
              </TabsContent>
              <TabsContent value="history" className="pt-2 text-sm">
                정책 변경 이력
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        <Section title="Calendar" description="인라인 / Popover 날짜 선택">
          <div className="flex flex-wrap items-start gap-8">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg border"
            />
            <Popover>
              <PopoverTrigger
                render={<Button variant="outline" className="w-48 justify-start" />}
              >
                <CalendarIcon data-icon="inline-start" />
                {date ? date.toLocaleDateString("ko-KR") : "날짜 선택"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>
          </div>
        </Section>

        <Section
          title="Overlays"
          description="Dialog, Alert Dialog, Sheet, Popover"
        >
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                Dialog
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>프로필 수정</DialogTitle>
                  <DialogDescription>
                    변경 후 저장 버튼을 눌러주세요.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="dialog-name">이름</FieldLabel>
                    <Input id="dialog-name" defaultValue="김민수" />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    취소
                  </DialogClose>
                  <Button>저장</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                Alert Dialog
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <Trash2Icon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>직원을 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    삭제한 직원의 근태 기록은 복구할 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>
                Sheet
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>필터</SheetTitle>
                  <SheetDescription>근태 목록 필터를 설정합니다.</SheetDescription>
                </SheetHeader>
                <FieldGroup className="px-4">
                  <Field orientation="horizontal">
                    <Checkbox id="late-only" />
                    <FieldLabel htmlFor="late-only">지각자만 보기</FieldLabel>
                  </Field>
                </FieldGroup>
                <SheetFooter>
                  <SheetClose render={<Button />}>적용</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>
                Sheet (left)
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>메뉴</SheetTitle>
                  <SheetDescription>side=&quot;left&quot;</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>
                Popover
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>근무 시간</PopoverTitle>
                  <PopoverDescription>09:00 - 18:00 (휴게 1시간)</PopoverDescription>
                </PopoverHeader>
              </PopoverContent>
            </Popover>
          </div>
        </Section>

        <Section title="Dropdown Menu" description="그룹, 체크박스, 라디오, 서브메뉴">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              내 계정
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>김민수</DropdownMenuLabel>
                <DropdownMenuItem>
                  <UserIcon />
                  프로필
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SettingsIcon />
                  설정
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>보기</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={showWeekend}
                  onCheckedChange={setShowWeekend}
                >
                  주말 표시
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>정렬</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                  <DropdownMenuRadioItem value="name">이름순</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="team">팀순</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>팀 이동</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TEAMS.map((team) => (
                    <DropdownMenuItem key={team.value}>{team.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOutIcon />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Tooltip & Toast" description="Tooltip, Sonner">
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>
                Hover me
              </TooltipTrigger>
              <TooltipContent>출근 시간: 09:02</TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={() => toast("출근이 기록되었습니다.")}>
              Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success("퇴근이 기록되었습니다.")}
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error("이미 출근 처리되었습니다.")}
            >
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast("정책이 변경되었습니다.", {
                  description: "개발팀 · 유연근무제",
                  action: { label: "되돌리기", onClick: () => {} },
                })
              }
            >
              With action
            </Button>
          </div>
        </Section>

        <Section title="Pagination" description="페이지 이동">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#Pagination" text="이전" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#Pagination">1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#Pagination" isActive>
                  2
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#Pagination">3</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#Pagination" text="다음" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </Section>

        <Section title="Skeleton" description="로딩 상태">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </Section>

        <Section title="Scroll Area" description="Separator와 함께 사용한 스크롤 영역">
          <ScrollArea className="h-56 w-64 rounded-lg border">
            <div className="p-4">
              <h3 className="mb-4 text-sm font-medium">정책 변경 이력</h3>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i}>
                  <div className="text-sm">v{20 - i}.0 · 근무 정책 수정</div>
                  <Separator className="my-2" />
                </div>
              ))}
            </div>
          </ScrollArea>
        </Section>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
