'use client';

import * as React from 'react';
import QRCode from 'qrcode';

export interface PaymentQRCodeProps {
  customerKey: string;
  billId?: string;
  monthYear: string;
  amount: number;
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export function PaymentQRCode({
  customerKey,
  billId,
  monthYear,
  amount,
  size = 100,
  className = '',
  showBadge = true,
}: PaymentQRCodeProps) {
  const [svgMarkup, setSvgMarkup] = React.useState<string>('');

  const rawPayload = React.useMemo(() => {
    const cleanKey = customerKey?.trim() || 'CUST';
    const cleanBill = billId?.trim() || 'BILL';
    const cleanMonth = monthYear?.trim() || 'PERIOD';
    const cleanAmt = (amount || 0).toFixed(2);
    // Standard utility payment string recognized by Ethiopian banking integrations
    return `AAWSA|PAY|${cleanKey}|${cleanBill}|${cleanMonth}|${cleanAmt}`;
  }, [customerKey, billId, monthYear, amount]);

  React.useEffect(() => {
    let isMounted = true;
    QRCode.toString(rawPayload, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((svg) => {
        if (isMounted) setSvgMarkup(svg);
      })
      .catch((err) => {
        console.error('Failed to generate QR code SVG:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [rawPayload, size]);

  return (
    <div className={`flex flex-col items-center justify-center p-2 bg-white rounded border border-gray-200 text-center ${className}`}>
      {svgMarkup ? (
        <div
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
          className="overflow-hidden flex items-center justify-center"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center bg-gray-100 text-gray-400 text-xs rounded"
          style={{ width: size, height: size }}
        >
          Loading QR...
        </div>
      )}

      {showBadge && (
        <div className="mt-1 flex flex-col items-center">
          <div className="text-[9px] font-bold tracking-tight text-gray-800 uppercase">
            Scan to Pay
          </div>
          <div className="text-[7.5px] text-gray-500 font-medium">
            Telebirr • CBE Birr
          </div>
        </div>
      )}
    </div>
  );
}
