interface Props {
  currentStep: number
  steps: string[]
}

export default function StepIndicator({ currentStep, steps }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                i < currentStep
                  ? 'bg-emerald-500 text-white'
                  : i === currentStep
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i === currentStep ? 'text-blue-400' : 'text-slate-500'}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-0.5 mb-5 mx-1 ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
